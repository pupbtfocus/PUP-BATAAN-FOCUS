import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import { logger } from "@/lib/observability/logger";

type HistoryStatus = "Pending" | "Validated" | "Rejected";

type HistorySubmission = {
  id: string;
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
  requirementCode: RequirementCode;
  status: HistoryStatus;
  submittedAt: string;
  remarks?: string;
};

type ReviewDecision = {
  decision: "validated" | "rejected";
  remarks?: string | null;
  created_at?: string | null;
};

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
  submittedAt: string;
} {
  const sourceDate = dateInput ? new Date(dateInput) : new Date();
  const date = Number.isNaN(sourceDate.getTime()) ? new Date() : sourceDate;

  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const startsSchoolYear = month >= 6;

  return {
    academicYear: startsSchoolYear
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
    submittedAt: date.toISOString().split("T")[0],
  };
}

function toHistoryStatus(
  submissionStatus: string | null,
  latestReview?: ReviewDecision,
): HistoryStatus {
  if (
    latestReview?.decision === "validated" ||
    submissionStatus === "validated"
  ) {
    return "Validated";
  }

  if (
    latestReview?.decision === "rejected" ||
    submissionStatus === "rejected"
  ) {
    return "Rejected";
  }

  return "Pending";
}

export async function GET() {
  try {
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

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("profile_id")
      .eq("auth_user_id", user.id)
      .single();

    if (appUserError || !appUser?.profile_id) {
      logger.error("faculty_not_found", {
        authUserId: user.id,
        error: appUserError?.message,
      });
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        submitted_at,
        created_at,
        review_decisions(
          decision,
          remarks,
          created_at
        )
      `,
      )
      .eq("faculty_profile_id", appUser.profile_id)
      .order("submitted_at", { ascending: false });

    if (submissionsError) {
      logger.error("submission_history_fetch_failed", {
        facultyId: appUser.profile_id,
        error: submissionsError.message,
      });
      return NextResponse.json(
        { error: "Failed to load submission history" },
        { status: 500 },
      );
    }

    const history: HistorySubmission[] = (submissions || [])
      .filter((row) =>
        DEFAULT_REQUIREMENTS.includes(row.requirement_code as RequirementCode),
      )
      .map((row) => {
        const reviews = (
          (row.review_decisions as ReviewDecision[] | null) || []
        )
          .filter((review) => !!review.created_at)
          .sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
            return bTime - aTime;
          });

        const latestReview = reviews[0];
        const term = toAcademicYearAndSemester(
          row.submitted_at || row.created_at,
        );

        return {
          id: row.id,
          academicYear: term.academicYear,
          semester: term.semester,
          requirementCode: row.requirement_code as RequirementCode,
          status: toHistoryStatus(row.status, latestReview),
          submittedAt: term.submittedAt,
          remarks: latestReview?.remarks || undefined,
        };
      });

    return NextResponse.json({
      submissions: history,
      total: history.length,
    });
  } catch (error) {
    logger.error("submission_history_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
