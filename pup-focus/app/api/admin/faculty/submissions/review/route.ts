import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { logger } from "@/lib/observability/logger";

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

    console.log("Processing review:", {
      submissionId,
      decision,
      remarks,
      reviewerProfileId: adminAppUser.profile_id,
    });

    // Update the submission status
    const { error: updateError } = await supabase
      .from("submissions")
      .update({ status: decision })
      .eq("id", submissionId);

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
        remarks: remarks || null,
      });

    if (reviewError) {
      console.error("Failed to create review decision:", reviewError);
      // Don't return error since submission was already updated
    }

    console.log("Review processed successfully");
    return NextResponse.json({
      success: true,
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
