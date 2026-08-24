import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";
import { createNotification } from "@/features/notifications/services/notification.service";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";

type ValidationRequest = {
  submissionId: string;
  decision: "validated" | "rejected";
  remarks?: string;
};

export async function POST(request: NextRequest) {
  try {
    // Verify admin role
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

    // Get admin's profile ID
    const supabase = getServiceRoleClient();
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!adminProfile?.id) {
      console.error(
        "Admin profile not found in /api/admin/faculty/submissions/validate for auth user:",
        user.id,
      );
      logger.error("admin_profile_not_found", { authUserId: user.id });
      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 400 },
      );
    }

    const { submissionId, decision, remarks } =
      (await request.json()) as ValidationRequest;

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

    const cleanRemarks =
      remarks && typeof remarks === "string" && remarks.trim()
        ? remarks.trim()
        : null;

    // Update submission status and admin_remarks (gracefully handling missing columns)
    let updateError: { message: string } | null = null;

    // Step 1: Full update with status, admin_remarks, and updated_at
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
      // Step 2: Fallback without updated_at
      const payloadNoUpdatedAt: Record<string, unknown> = { status: decision };
      if (cleanRemarks) {
        payloadNoUpdatedAt.admin_remarks = cleanRemarks;
      }

      const { error: secondErr } = await supabase
        .from("submissions")
        .update(payloadNoUpdatedAt)
        .eq("id", submissionId);

      if (secondErr) {
        // Step 3: Fallback without admin_remarks
        const { error: thirdErr } = await supabase
          .from("submissions")
          .update({
            status: decision,
            updated_at: new Date().toISOString(),
          })
          .eq("id", submissionId);

        if (thirdErr) {
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
      console.error(
        "Failed to update submission in /api/admin/faculty/submissions/validate:",
        updateError,
      );
      logger.error("submission_update_failed", {
        submissionId,
        error: updateError.message,
      });
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 },
      );
    }

    // Create review decision record
    const { error: reviewError } = await supabase
      .from("review_decisions")
      .insert({
        submission_id: submissionId,
        reviewer_profile_id: adminProfile.id,
        decision,
        remarks: cleanRemarks,
      });

    if (reviewError) {
      console.error(
        "Failed to create review decision in /api/admin/faculty/submissions/validate:",
        reviewError,
      );
      logger.error("review_decision_creation_failed", {
        submissionId,
        error: reviewError.message,
      });
    }

    try {
      await supabase.from("verification_history").insert({
        submission_id: submissionId,
        status: decision,
        decision,
        remarks: cleanRemarks,
        reviewed_by: adminProfile.id,
        reviewer_profile_id: adminProfile.id,
      });
    } catch {
      // verification_history is optional
    }

    // Dispatch notification to submitting faculty member
    try {
      const { data: submission } = await supabase
        .from("submissions")
        .select("id, faculty_profile_id, requirement_code, academic_year, semester")
        .eq("id", submissionId)
        .maybeSingle();

      let targetAuthUserId: string | null = null;

      // 1. Check uploader from document_versions
      const { data: docVersion } = await supabase
        .from("document_versions")
        .select("created_by")
        .eq("submission_id", submissionId)
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (docVersion?.created_by) {
        targetAuthUserId = docVersion.created_by;
      }

      // 2. Check profile by faculty_profile_id
      if (!targetAuthUserId && submission?.faculty_profile_id) {
        const { data: facultyProfile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("id", submission.faculty_profile_id)
          .maybeSingle();

        if (facultyProfile?.user_id) {
          targetAuthUserId = facultyProfile.user_id;
        }
      }

      if (targetAuthUserId && targetAuthUserId !== user.id) {
        const reqCode = (submission?.requirement_code ?? "REQUIREMENT") as RequirementCode;
        const reqLabel = REQUIREMENT_LABEL[reqCode] || reqCode || "Requirement";

        let notifType = "SUBMISSION_APPROVED";
        let notifTitle = "Submission Approved";
        let notifMessage = `Your submission for "${reqLabel}" has been approved${cleanRemarks ? `: "${cleanRemarks}"` : "."}`;

        if (decision === "rejected") {
          notifType = "SUBMISSION_REJECTED";
          notifTitle = "Submission Rejected";
          notifMessage = `Your submission for "${reqLabel}" was rejected${cleanRemarks ? `: "${cleanRemarks}"` : ". Please review and resubmit."}`;
        } else if ((decision as string) === "needs_revision" || (decision as string) === "revision_requested") {
          notifType = "REVISION_REQUESTED";
          notifTitle = "Revision Requested";
          notifMessage = `Revision requested for "${reqLabel}"${cleanRemarks ? `: "${cleanRemarks}"` : ". Please update your submission."}`;
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
            decision,
            remarks: cleanRemarks,
            reviewer_profile_id: adminProfile.id,
            reviewer_user_id: user.id,
          },
        });
      }
    } catch (notifErr) {
      console.error("Failed to send verification notification to faculty in validate route:", notifErr);
      logger.error("faculty_verification_notification_failed", {
        submissionId,
        error: notifErr instanceof Error ? notifErr.message : String(notifErr),
      });
    }

    logger.info("submission_validated", {
      submissionId,
      decision,
      reviewerProfileId: adminProfile.id,
    });

    return NextResponse.json({
      success: true,
      submissionId,
      decision,
      status: decision,
      remarks: cleanRemarks,
    });
  } catch (error) {
    console.error(
      "Unhandled error in /api/admin/faculty/submissions/validate:",
      error,
    );
    logger.error("validation_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
