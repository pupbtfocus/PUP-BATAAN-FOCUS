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
    const { submissionId, decision, status, remarks, adminRemarks, admin_remarks } = body;

    // Validate input
    if (!submissionId) {
      return NextResponse.json(
        { error: "submissionId is required" },
        { status: 400 },
      );
    }

    const rawDecision = decision || status || "";
    const normDecision = String(rawDecision).toLowerCase().trim();
    let cleanDecision: "validated" | "rejected";

    if (["validated", "approved", "accept"].includes(normDecision)) {
      cleanDecision = "validated";
    } else if (
      [
        "rejected",
        "needs_revision",
        "returned",
        "revision",
        "revision_requested",
      ].includes(normDecision)
    ) {
      cleanDecision = "rejected";
    } else {
      return NextResponse.json(
        { error: "decision must be 'validated' or 'rejected'" },
        { status: 400 },
      );
    }

    const supabaseAdmin = getServiceRoleClient();

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminProfile?.id) {
      logger.error("admin_profile_not_found", { authUserId: user.id });
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 400 },
      );
    }

    const rawRemarks = remarks || adminRemarks || admin_remarks || "";
    const cleanRemarks =
      typeof rawRemarks === "string" && rawRemarks.trim()
        ? rawRemarks.trim()
        : null;

    logger.info("processing_admin_review", {
      submissionId,
      decision: cleanDecision,
      remarks: cleanRemarks,
      reviewerProfileId: adminProfile.id,
    });

    // Fetch details of submission being reviewed to identify the target faculty member
    const { data: submission } = await supabaseAdmin
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, academic_year, semester")
      .eq("id", submissionId)
      .maybeSingle();

    // Update the submission status and admin_remarks (gracefully handling missing columns)
    let updateError: { message: string } | null = null;

    // Step 1: Attempt update with status, admin_remarks, remarks, and updated_at
    const fullPayload: Record<string, unknown> = {
      status: cleanDecision,
      updated_at: new Date().toISOString(),
    };
    if (cleanRemarks) {
      fullPayload.admin_remarks = cleanRemarks;
      fullPayload.remarks = cleanRemarks;
    }

    const { error: firstErr } = await supabaseAdmin
      .from("submissions")
      .update(fullPayload)
      .eq("id", submissionId);

    if (firstErr) {
      console.warn("Full submission update failed, trying fallback without remarks:", firstErr.message);

      // Step 2: Fallback with status and admin_remarks only
      const payloadAdminRemarksOnly: Record<string, unknown> = {
        status: cleanDecision,
        updated_at: new Date().toISOString(),
      };
      if (cleanRemarks) {
        payloadAdminRemarksOnly.admin_remarks = cleanRemarks;
      }

      const { error: secondErr } = await supabaseAdmin
        .from("submissions")
        .update(payloadAdminRemarksOnly)
        .eq("id", submissionId);

      if (secondErr) {
        console.warn("Fallback with admin_remarks failed, trying fallback with status and updated_at:", secondErr.message);

        // Step 3: Fallback without admin_remarks (if admin_remarks column missing)
        const { error: thirdErr } = await supabaseAdmin
          .from("submissions")
          .update({
            status: cleanDecision,
            updated_at: new Date().toISOString(),
          })
          .eq("id", submissionId);

        if (thirdErr) {
          console.warn("Fallback with updated_at failed, trying minimal update (status only):", thirdErr.message);

          // Step 4: Minimal update (status only)
          const { error: minimalErr } = await supabaseAdmin
            .from("submissions")
            .update({ status: cleanDecision })
            .eq("id", submissionId);

          updateError = minimalErr;
        }
      }
    }

    if (updateError) {
      console.error("Failed to update submission:", updateError);
      return NextResponse.json(
        { error: `Failed to update submission: ${updateError.message}` },
        { status: 400 },
      );
    }

    try {
      const { error: reviewErr } = await supabaseAdmin
        .from("review_decisions")
        .insert({
          submission_id: submissionId,
          reviewer_profile_id: adminProfile.id,
          decision: cleanDecision,
          remarks: cleanRemarks || null,
        });

      if (reviewErr) {
        console.warn(
          "[ADMIN_REVIEW_WARN] Could not record review decision log (non-critical):",
          reviewErr.message,
        );
      }
    } catch (err) {
      console.warn(
        "[ADMIN_REVIEW_WARN] review_decisions table missing, continuing review flow cleanly.",
      );
    }

    try {
      await supabaseAdmin.from("verification_history").insert({
        submission_id: submissionId,
        status: cleanDecision,
        decision: cleanDecision,
        remarks: cleanRemarks,
        reviewed_by: adminProfile.id,
        reviewer_profile_id: adminProfile.id,
      });
    } catch {
      // verification_history is optional
    }

    // Notification – send notification to the faculty member who submitted
    try {
      let targetAuthUserId: string | null = null;

      // 1. Check uploader from document_versions
      const { data: docVersion } = await supabaseAdmin
        .from("document_versions")
        .select("created_by")
        .eq("submission_id", submissionId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (docVersion?.created_by) {
        targetAuthUserId = docVersion.created_by;
      }

      // 2. Check profiles by faculty_profile_id
      if (!targetAuthUserId && submission?.faculty_profile_id) {
        const { data: profile } = await supabaseAdmin
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

        let notifType = "SUBMISSION_APPROVED";
        let notifTitle = "Submission Approved";
        let notifMessage = `Your submission for "${reqLabel}" has been approved${cleanRemarks ? `: "${cleanRemarks}"` : "."}`;

        if (cleanDecision === "rejected") {
          notifType = "SUBMISSION_REJECTED";
          notifTitle = "Revision Requested";
          notifMessage = `Revision requested for "${reqLabel}"${cleanRemarks ? `: "${cleanRemarks}"` : ". Please review and resubmit."}`;
        }

        await createNotification({
          userId: targetAuthUserId,
          type: notifType,
          title: notifTitle,
          message: notifMessage,
          metadata: {
            submission_id: submissionId,
            submissionId,
            requirement_code: submission?.requirement_code,
            requirementCode: submission?.requirement_code,
            reviewed_by: adminProfile.id,
            reviewerName: adminProfile.full_name || "Reviewer",
            decision: cleanDecision,
            remarks: cleanRemarks,
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
        action: cleanDecision === "validated" ? "submission.approve" : "submission.reject",
        entityType: "submission",
        entityId: submissionId,
        metadata: {
          review_decision: cleanDecision,
          remarks: cleanRemarks,
          reviewer_profile_id: adminProfile.id,
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
      status: cleanDecision,
      decision: cleanDecision,
      remarks: cleanRemarks,
      message: `Submission ${cleanDecision} successfully`,
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
