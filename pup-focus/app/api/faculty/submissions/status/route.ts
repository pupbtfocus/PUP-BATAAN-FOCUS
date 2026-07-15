import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import { logger } from "@/lib/observability/logger";

type RequirementStatus = {
  code: string;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
  note?: string;
  submittedAt?: string;
  latestSubmissionId?: string;
};

type ReviewDecision = {
  decision: "validated" | "rejected";
  remarks?: string | null;
  created_at?: string | null;
};

type SubmissionRow = {
  id: string;
  requirement_code: string;
  status: string | null;
  submitted_at?: string | null;
  remarks?: string | null;
  document_versions?: Array<{ id: string }> | null;
  review_decisions?: ReviewDecision[] | null;
};

function isRequirementCode(value: string): value is RequirementCode {
  return (DEFAULT_REQUIREMENTS as readonly string[]).includes(value);
}

function hasDocumentVersion(submission: {
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  return Array.isArray(submission.document_versions)
    ? submission.document_versions.length > 0
    : false;
}

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate faculty user
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - not authenticated" },
        { status: 401 },
      );
    }

    const supabase = getServiceRoleClient();

    // Always fetch fresh profile_id from database (don't use cached session)
    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: appUserError?.message,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    console.log(
      "Faculty profile found:",
      appUser.profile_id,
      "for auth_user:",
      user.id,
    );

    // Get all submissions with review decisions
    const initialResult = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        submitted_at,
        remarks,
        document_versions(id),
        review_decisions(
          decision,
          remarks,
          created_at
        )
      `,
      )
      .eq("faculty_profile_id", appUser.profile_id)
      .order("submitted_at", { ascending: false });

    let submissions = (initialResult.data as SubmissionRow[] | null) ?? null;
    let submissionsError = initialResult.error;

    if (submissionsError && isMissingRemarksColumnError(submissionsError)) {
      const fallbackResult = await supabase
        .from("submissions")
        .select(
          `
          id,
          requirement_code,
          status,
          submitted_at,
          document_versions(id),
          review_decisions(
            decision,
            remarks,
            created_at
          )
        `,
        )
        .eq("faculty_profile_id", appUser.profile_id)
        .order("submitted_at", { ascending: false });

      submissions = (fallbackResult.data as SubmissionRow[] | null) ?? null;
      submissionsError = fallbackResult.error;
    }

    console.log("Submissions query result:", {
      count: submissions?.length,
      error: submissionsError,
      profileId: appUser.profile_id,
    });

    if (submissionsError) {
      logger.error("submissions_fetch_failed", {
        facultyId: appUser.profile_id,
        error: submissionsError.message,
      });
      return NextResponse.json(
        { error: "Failed to load submissions" },
        { status: 500 },
      );
    }

    // Map submissions to requirement status format
    const statusMap = new Map<string, RequirementStatus>();

    // Initialize all requirements as Not Submitted
    for (const code of DEFAULT_REQUIREMENTS) {
      statusMap.set(code, {
        code,
        status: "Not Submitted",
      });
    }

    // Update with actual submission data
    for (const submission of submissions || []) {
      const code = submission.requirement_code;

      // Skip if not a valid requirement code
      if (!isRequirementCode(code)) {
        continue;
      }

      // Treat a submission as not submitted when it has no document version.
      if (!hasDocumentVersion(submission)) {
        continue;
      }

      // Get the latest review decision if exists
      const latestReview = (submission.review_decisions || [])[0];

      let status: "Validated" | "Rejected" | "Pending" | "Not Submitted" =
        "Not Submitted";

      // Check submission status first (updated by admin approval)
      if (submission.status === "validated") {
        status = "Validated";
      } else if (submission.status === "rejected") {
        status = "Rejected";
      } else if (latestReview?.decision === "validated") {
        status = "Validated";
      } else if (latestReview?.decision === "rejected") {
        status = "Rejected";
      } else if (submission.status === "uploaded") {
        status = "Pending";
      }

      statusMap.set(code, {
        code,
        status,
        reviewedAt: latestReview?.created_at
          ? new Date(latestReview.created_at).toISOString().split("T")[0]
          : undefined,
        feedback: latestReview?.remarks || undefined,
        note:
          "remarks" in submission && typeof submission.remarks === "string"
            ? submission.remarks
            : undefined,
        submittedAt: submission.submitted_at || undefined,
        latestSubmissionId: submission.id,
      });
    }

    const requirementStatuses = Array.from(statusMap.values());

    // Calculate counts
    const counts = {
      total: requirementStatuses.length,
      validated: requirementStatuses.filter((r) => r.status === "Validated")
        .length,
      rejected: requirementStatuses.filter((r) => r.status === "Rejected")
        .length,
      pending: requirementStatuses.filter((r) => r.status === "Pending").length,
      notSubmitted: requirementStatuses.filter(
        (r) => r.status === "Not Submitted",
      ).length,
    };

    console.log("Status endpoint returning:", {
      submissionsCount: submissions?.length,
      profileId: appUser.profile_id,
      counts,
    });

    return NextResponse.json({
      requirementStatuses,
      counts,
      debug: {
        profileId: appUser.profile_id,
        submissionsFound: submissions?.length || 0,
      },
    });
  } catch (error) {
    logger.error("status_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
