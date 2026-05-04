import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, decision, remarks, reviewerProfileId } = body;

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

    console.log("Processing review:", {
      submissionId,
      decision,
      remarks,
      reviewerProfileId,
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

    // Create a review decision record if reviewerProfileId is provided
    if (reviewerProfileId) {
      const { error: reviewError } = await supabase
        .from("review_decisions")
        .insert({
          submission_id: submissionId,
          reviewer_profile_id: reviewerProfileId,
          decision: decision,
          remarks: remarks || null,
        });

      if (reviewError) {
        console.error("Failed to create review decision:", reviewError);
        // Don't return error since submission was already updated
      }
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
