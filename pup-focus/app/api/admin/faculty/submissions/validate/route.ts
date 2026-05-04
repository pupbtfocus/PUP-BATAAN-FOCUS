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
    const { data: adminAppUser } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!adminAppUser?.profile_id) {
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

    // Update submission status
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ status: decision })
      .eq("id", submissionId);

    if (updateError) {
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
        reviewer_profile_id: adminAppUser.profile_id,
        decision,
        remarks: remarks || null,
      });

    if (reviewError) {
      logger.error("review_decision_creation_failed", {
        submissionId,
        error: reviewError.message,
      });
      return NextResponse.json(
        { error: "Failed to create review record" },
        { status: 500 },
      );
    }

    logger.info("submission_validated", {
      submissionId,
      decision,
      reviewerProfileId: adminAppUser.profile_id,
    });

    return NextResponse.json({
      success: true,
      submissionId,
      decision,
    });
  } catch (error) {
    logger.error("validation_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
