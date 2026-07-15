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
  note?: string;
  remarks?: string;
  reviewedAt?: string;
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
  created_at?: string | null;
  remarks?: string | null;
  document_versions?: Array<{ id: string }> | null;
  review_decisions?: ReviewDecision[] | null;
};

function hasDocumentVersion(row: {
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  return Array.isArray(row.document_versions)
    ? row.document_versions.length > 0
    : false;
}

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
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

    const initialResult = await supabase
      .from("submissions")
      .select(
        `
        id,
        requirement_code,
        status,
        submitted_at,
        created_at,
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
          created_at,
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
      .filter((row) => hasDocumentVersion(row))
      .map((row) => {
        const reviews = (row.review_decisions || [])
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
          submittedAt:
            row.submitted_at || row.created_at || new Date().toISOString(),
          note: typeof row.remarks === "string" ? row.remarks : undefined,
          remarks: latestReview?.remarks || undefined,
          reviewedAt: latestReview?.created_at
            ? new Date(latestReview.created_at).toISOString().split("T")[0]
            : undefined,
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
