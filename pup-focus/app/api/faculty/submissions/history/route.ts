export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    // 1. Authenticate user inside try-catch
    let user = null;
    try {
      const sessionClient = await createServerSupabaseClient();
      const {
        data: { user: authUser },
      } = await sessionClient.auth.getUser();
      user = authUser;
    } catch (sessionError) {
      logger.error("history_session_extraction_failed", {
        error: sessionError instanceof Error ? sessionError.message : String(sessionError),
      });
      return NextResponse.json(
        { error: "Unauthorized - session extraction error" },
        { status: 401 },
      );
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - not authenticated" },
        { status: 401 },
      );
    }

    let supabase;
    try {
      supabase = getServiceRoleClient();
    } catch (clientError) {
      logger.error("supabase_client_creation_failed", {
        error: clientError instanceof Error ? clientError.message : String(clientError),
      });
      return NextResponse.json(
        {
          submissions: [],
          total: 0,
          message: "Database connection unavailable",
        },
        { status: 200 },
      );
    }

    // 2. App user lookup with null-guard
    let appUser: { profile_id: string | null } | null = null;
    try {
      const { data, error } = await supabase
        .from("app_users")
        .select("profile_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        appUser = data;
      } else if (error) {
        logger.error("history_app_user_query_error", {
          authUserId: user.id,
          error: error.message,
        });
      }
    } catch (userQueryErr) {
      logger.error("history_app_user_query_exception", {
        error: userQueryErr instanceof Error ? userQueryErr.message : String(userQueryErr),
      });
    }

    if (!appUser || !appUser.profile_id) {
      logger.warn("history_faculty_profile_missing", { authUserId: user.id });
      return NextResponse.json(
        {
          submissions: [],
          total: 0,
          message: "No program assigned",
        },
        { status: 200 },
      );
    }

    // 3. Program assignments null-guard
    let assignments: Array<{ id: string }> = [];
    try {
      const { data, error } = await supabase
        .from("faculty_program_assignments")
        .select("id")
        .eq("faculty_profile_id", appUser.profile_id);

      if (!error && Array.isArray(data)) {
        assignments = data;
      } else if (error) {
        logger.warn("history_program_assignments_fetch_failed", {
          facultyId: appUser.profile_id,
          error: error.message,
        });
      }
    } catch (assignErr) {
      logger.warn("history_program_assignments_exception", {
        facultyId: appUser.profile_id,
        error: assignErr instanceof Error ? assignErr.message : String(assignErr),
      });
    }

    if (assignments.length === 0) {
      logger.info("history_no_program_assignments_found", { facultyId: appUser.profile_id });
      return NextResponse.json(
        {
          submissions: [],
          total: 0,
          message: "No program assigned",
        },
        { status: 200 },
      );
    }

    // 4. Query submissions and related tables separately to avoid relational schema cache join errors
    let rawSubmissions: Array<{
      id: string;
      requirement_code: string;
      status: string | null;
      submitted_at?: string | null;
      created_at?: string | null;
      remarks?: string | null;
      faculty_assignment_id?: string | null;
    }> = [];

    try {
      const { data, error } = await supabase
        .from("submissions")
        .select("id, requirement_code, status, submitted_at, created_at, remarks, faculty_assignment_id")
        .eq("faculty_profile_id", appUser.profile_id)
        .order("submitted_at", { ascending: false });

      if (error && isMissingRemarksColumnError(error)) {
        const { data: fallbackData } = await supabase
          .from("submissions")
          .select("id, requirement_code, status, submitted_at, created_at, faculty_assignment_id")
          .eq("faculty_profile_id", appUser.profile_id)
          .order("submitted_at", { ascending: false });
        rawSubmissions = (fallbackData as typeof rawSubmissions) || [];
      } else if (data) {
        rawSubmissions = data as typeof rawSubmissions;
      }
    } catch (queryErr) {
      logger.error("history_submissions_query_exception", {
        error: queryErr instanceof Error ? queryErr.message : String(queryErr),
      });
    }

    const submissionIds = rawSubmissions.map((s) => s.id);

    // Fetch document_versions separately
    const docVersionsMap = new Map<string, Array<{ id: string }>>();
    if (submissionIds.length > 0) {
      const { data: docVersions } = await supabase
        .from("document_versions")
        .select("id, submission_id")
        .in("submission_id", submissionIds);

      if (docVersions) {
        for (const doc of docVersions) {
          const list = docVersionsMap.get(doc.submission_id) || [];
          list.push({ id: doc.id });
          docVersionsMap.set(doc.submission_id, list);
        }
      }
    }

    // Fetch review_decisions separately
    const reviewDecisionsMap = new Map<string, ReviewDecision[]>();
    if (submissionIds.length > 0) {
      const { data: decisions } = await supabase
        .from("review_decisions")
        .select("submission_id, decision, remarks, created_at")
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: false });

      if (decisions) {
        for (const d of decisions) {
          const list = reviewDecisionsMap.get(d.submission_id) || [];
          list.push({
            decision: d.decision as "validated" | "rejected",
            remarks: d.remarks,
            created_at: d.created_at,
          });
          reviewDecisionsMap.set(d.submission_id, list);
        }
      }
    }

    const submissions: SubmissionRow[] = rawSubmissions.map((s) => ({
      id: s.id,
      requirement_code: s.requirement_code,
      status: s.status,
      submitted_at: s.submitted_at,
      created_at: s.created_at,
      remarks: s.remarks,
      faculty_assignment_id: s.faculty_assignment_id,
      document_versions: docVersionsMap.get(s.id) || [],
      review_decisions: reviewDecisionsMap.get(s.id) || [],
    }));

    // 5. Map history submissions safely
    const history: HistorySubmission[] = [];
    for (const row of submissions || []) {
      if (!row || typeof row !== "object") continue;
      if (
        !row.requirement_code ||
        !DEFAULT_REQUIREMENTS.includes(row.requirement_code as RequirementCode)
      ) {
        continue;
      }
      if (!hasDocumentVersion(row)) continue;

      const reviews = (Array.isArray(row.review_decisions) ? row.review_decisions : [])
        .filter((review) => !!review && !!review.created_at)
        .sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

      const latestReview = reviews[0];
      const term = toAcademicYearAndSemester(
        row.submitted_at || row.created_at,
      );

      history.push({
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
      });
    }

    return NextResponse.json({
      submissions: history,
      total: history.length,
    });
  } catch (error) {
    logger.error("submission_history_endpoint_error", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return NextResponse.json(
      {
        submissions: [],
        total: 0,
        message: "Internal server error handled gracefully",
      },
      { status: 200 },
    );
  }
}
