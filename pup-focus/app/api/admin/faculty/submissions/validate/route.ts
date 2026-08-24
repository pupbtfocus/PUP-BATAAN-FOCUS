import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";

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
