import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { createNotification } from "@/features/notifications/services/notification.service";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { submissionId, decision, remarks } = body;

    // Validate input
    if (!submissionId || !decision) {
      return NextResponse.json(
        { error: "submissionId and decision are required" },
        { status: 400 },
      );
    }

    if (!["validated", "rejected"].includes(decision)) {
      return NextResponse.json(
        { error: "decision must be 'validated' or 'rejected'" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: adminAppUser } = await supabase
      .from("app_users")
      .select("profile_id, full_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!adminAppUser?.profile_id) {
      logger.error("admin_profile_not_found", { authUserId: user.id });
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 400 },
      );
    }

    console.log("Processing review:", {
      submissionId,
      decision,
      remarks,
      reviewerProfileId: adminAppUser.profile_id,
    });

    // Fetch details of submission being reviewed to identify the target faculty member
    const { data: submission } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, academic_year, semester")
      .eq("id", submissionId)
      .maybeSingle();

    const cleanRemarks =
      remarks && typeof remarks === "string" && remarks.trim()
        ? remarks.trim()
        : null;

    // Update the submission status and admin_remarks (gracefully handling missing columns)
    let updateError: { message: string } | null = null;

    // Step 1: Attempt update with status, admin_remarks, and updated_at
    const fullPayload: Record<string, unknown> = {
      status: decision,
      updated_at: new Date().toISOString(),
    };
    if (cleanRemarks) {
      fullPayload.admin_remarks = cleanRemarks;
    }

    const { error: firstErr } = await supabase
      .from("submissions")
      .update(fullPayload)
      .eq("id", submissionId);

    if (firstErr) {
      console.warn("Full submission update failed, trying fallback without updated_at:", firstErr.message);

      // Step 2: Fallback without updated_at (if updated_at column missing / PGRST204)
      const payloadNoUpdatedAt: Record<string, unknown> = { status: decision };
      if (cleanRemarks) {
        payloadNoUpdatedAt.admin_remarks = cleanRemarks;
      }

      const { error: secondErr } = await supabase
        .from("submissions")
        .update(payloadNoUpdatedAt)
        .eq("id", submissionId);

      if (secondErr) {
        console.warn("Fallback without updated_at failed, trying fallback with updated_at but without admin_remarks:", secondErr.message);

        // Step 3: Fallback without admin_remarks (if admin_remarks column missing)
        const { error: thirdErr } = await supabase
          .from("submissions")
          .update({
            status: decision,
            updated_at: new Date().toISOString(),
          })
          .eq("id", submissionId);

        if (thirdErr) {
          console.warn("Fallback without admin_remarks failed, trying minimal update:", thirdErr.message);

          // Step 4: Minimal update (status only)
          const { error: minimalErr } = await supabase
            .from("submissions")
            .update({ status: decision })
            .eq("id", submissionId);

          updateError = minimalErr;
        }
      }
    }

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json(
        { error: `Failed to update submission: ${updateError.message}` },
        { status: 400 },
      );
    }

    const { error: reviewError } = await supabase
      .from("review_decisions")
      .insert({
        submission_id: submissionId,
        reviewer_profile_id: adminAppUser.profile_id,
        decision: decision,
        remarks: cleanRemarks,
      });

    if (reviewError) {
      console.error("Failed to create review decision:", reviewError);
    }

    try {
      await supabase.from("verification_history").insert({
        submission_id: submissionId,
        status: decision,
        decision,
        remarks: cleanRemarks,
        reviewed_by: adminAppUser.profile_id,
        reviewer_profile_id: adminAppUser.profile_id,
      });
    } catch {
      // verification_history is optional
    }

    console.log("Review processed successfully");

    // Notification – send notification to the faculty member who submitted
    try {
      let targetAuthUserId: string | null = null;

      // 1. Check uploader from document_versions
      const { data: docVersion } = await supabase
        .from("document_versions")
        .select("created_by")
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (docVersion?.created_by) {
        targetAuthUserId = docVersion.created_by;
      }

      // 2. Check app_users by faculty_profile_id
      if (!targetAuthUserId && submission?.faculty_profile_id) {
        const { data: facultyAppUser } = await supabase
          .from("app_users")
          .select("auth_user_id")
          .eq("profile_id", submission.faculty_profile_id)
          .maybeSingle();

        if (facultyAppUser?.auth_user_id) {
          targetAuthUserId = facultyAppUser.auth_user_id;
        }
      }

      // 3. Check profiles by faculty_profile_id
      if (!targetAuthUserId && submission?.faculty_profile_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", submission.faculty_profile_id)
          .maybeSingle();

        if (profile?.user_id) {
          targetAuthUserId = profile.user_id;
        }
      }

      if (targetAuthUserId && targetAuthUserId !== user.id) {
        const reqCode = (submission?.requirement_code ?? "REQUIREMENT") as RequirementCode;
        const reqLabel = REQUIREMENT_LABEL[reqCode] || reqCode || "Requirement";
        const isApproved = decision === "validated";
        const isRevision = !isApproved && Boolean(remarks?.toLowerCase().includes("revision"));

        const notificationType = isApproved
          ? "submission_approved"
          : isRevision
            ? "revision_requested"
            : "submission_rejected";

        const title = isApproved
          ? `Document Approved: ${reqLabel}`
          : isRevision
            ? `Revision Requested: ${reqLabel}`
            : `Submission Rejected: ${reqLabel}`;

        const message = isApproved
          ? `Your submission for ${reqLabel} has been validated and approved.`
          : remarks
            ? `Reviewer feedback: "${remarks}"`
            : `Your submission for ${reqLabel} requires review/resubmission.`;

        await createNotification({
          userId: targetAuthUserId,
          type: notificationType,
          title,
          message,
          metadata: {
            submission_id: submissionId,
            submissionId,
            requirement_code: submission?.requirement_code,
            requirementCode: submission?.requirement_code,
            reviewed_by: adminAppUser.profile_id,
            reviewerName: adminAppUser.full_name || "Reviewer",
            decision,
            remarks: remarks || null,
          },
        });
      }
    } catch (notifError) {
      logger.error("notification_creation_failed_on_review", {
        submissionId,
        error: notifError instanceof Error ? notifError.message : String(notifError),
      });
    }

    // Audit log – fire-and-forget; never blocks the review response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: decision === "validated" ? "submission.approve" : "submission.reject",
        entityType: "submission",
        entityId: submissionId,
        metadata: {
          review_decision: decision,
          remarks: remarks || null,
          reviewer_profile_id: adminAppUser.profile_id,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_submission_review_failed", {
        submissionId,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    return NextResponse.json({
      success: true,
      submissionId,
      status: decision,
      remarks: cleanRemarks,
      message: `Submission ${decision} successfully`,
    });
  } catch (error) {
    console.error("Review submission error:", error);
    return NextResponse.json(
      {
        error: `Failed to process review: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
