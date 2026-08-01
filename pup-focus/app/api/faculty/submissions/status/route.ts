export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_REQUIREMENTS,
  type RequirementCode,
} from "@/config/compliance";
import { logger } from "@/lib/observability/logger";
import {
  evaluateSubmissionWindow,
  getSubmissionWindow,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";

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
    // 1. Authenticate faculty user with try-catch session extraction
    let user = null;
    try {
      const sessionClient = await createServerSupabaseClient();
      const {
        data: { user: authUser },
      } = await sessionClient.auth.getUser();
      user = authUser;
    } catch (sessionError) {
      logger.error("status_session_extraction_failed", {
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
      const defaultRequirementStatuses: RequirementStatus[] = DEFAULT_REQUIREMENTS.map(
        (code) => ({
          code,
          status: "Not Submitted" as const,
        }),
      );
      return NextResponse.json(
        {
          requirementStatuses: defaultRequirementStatuses,
          counts: {
            total: defaultRequirementStatuses.length,
            validated: 0,
            rejected: 0,
            pending: 0,
            notSubmitted: defaultRequirementStatuses.length,
          },
          message: "Database connection unavailable",
        },
        { status: 200 },
      );
    }

    // 2. Safely evaluate submission window
    let windowState;
    try {
      const submissionWindow = await getSubmissionWindow(supabase);
      windowState = evaluateSubmissionWindow(submissionWindow);
    } catch (windowError) {
      logger.warn("submission_window_eval_failed", {
        error: windowError instanceof Error ? windowError.message : String(windowError),
      });
      windowState = evaluateSubmissionWindow(null);
    }

    const localWindowStart = windowState.startDate
      ? `${windowState.startDate}T${normalizeTime24Hour(windowState.startTime ?? "09:00:00")}`
      : null;
    const localWindowEnd = windowState.endDate
      ? `${windowState.endDate}T${normalizeTime24Hour(windowState.endTime ?? "17:00:00")}`
      : null;

    function convertManilaDateTimeToUtcIso(
      dateTime: string | null,
    ): string | null {
      if (!dateTime) return null;
      const date = new Date(`${dateTime}+08:00`);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }

    const currentWindowStart = convertManilaDateTimeToUtcIso(localWindowStart);
    const currentWindowEnd = convertManilaDateTimeToUtcIso(localWindowEnd);

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

    const currentTerm =
      windowState.academicYear && windowState.semester
        ? {
            academicYear: windowState.academicYear,
            semester: windowState.semester,
          }
        : toAcademicYearAndSemester(windowState.today);

    // 3. App user lookup with null-guard
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
        logger.error("app_user_query_error", {
          authUserId: user.id,
          error: error.message,
        });
      }
    } catch (userQueryErr) {
      logger.error("app_user_query_exception", {
        error: userQueryErr instanceof Error ? userQueryErr.message : String(userQueryErr),
      });
    }

    const defaultRequirementStatuses: RequirementStatus[] = DEFAULT_REQUIREMENTS.map(
      (code) => ({
        code,
        status: "Not Submitted" as const,
      }),
    );
    const emptyCounts = {
      total: defaultRequirementStatuses.length,
      validated: 0,
      rejected: 0,
      pending: 0,
      notSubmitted: defaultRequirementStatuses.length,
    };

    if (!appUser || !appUser.profile_id) {
      logger.warn("faculty_profile_missing", { authUserId: user.id });
      return NextResponse.json(
        {
          requirementStatuses: defaultRequirementStatuses,
          counts: emptyCounts,
          message: "No program assigned",
        },
        { status: 200 },
      );
    }

    // 4. Program assignments null-guard
    let assignmentRows: Array<{ id: string; academic_year?: string; term?: string }> = [];
    try {
      const { data, error } = await supabase
        .from("faculty_program_assignments")
        .select("id, academic_year, term")
        .eq("faculty_profile_id", appUser.profile_id);

      if (!error && Array.isArray(data)) {
        assignmentRows = data;
      } else if (error) {
        logger.warn("faculty_program_assignments_fetch_failed", {
          facultyId: appUser.profile_id,
          error: error.message,
        });
      }
    } catch (assignmentErr) {
      logger.warn("faculty_program_assignments_exception", {
        facultyId: appUser.profile_id,
        error: assignmentErr instanceof Error ? assignmentErr.message : String(assignmentErr),
      });
    }

    if (assignmentRows.length === 0) {
      logger.info("no_program_assignments_found", { facultyId: appUser.profile_id });
      return NextResponse.json(
        {
          requirementStatuses: defaultRequirementStatuses,
          counts: emptyCounts,
          message: "No program assigned",
        },
        { status: 200 },
      );
    }

    const currentTermAssignments = assignmentRows.filter(
      (row) =>
        row.academic_year === currentTerm.academicYear &&
        row.term === currentTerm.semester,
    );
    const currentAssignmentIds = currentTermAssignments.map((row) => row.id);

    // 5. Query submissions and related tables separately to avoid relational schema cache join errors
    let rawSubmissions: Array<{
      id: string;
      requirement_code: string;
      status: string | null;
      submitted_at?: string | null;
      remarks?: string | null;
    }> = [];

    if (windowState.isConfigured) {
      try {
        const { data, error } = await supabase
          .from("submissions")
          .select("id, requirement_code, status, submitted_at, remarks")
          .eq("faculty_profile_id", appUser.profile_id)
          .order("submitted_at", { ascending: false });

        if (error && isMissingRemarksColumnError(error)) {
          const { data: fallbackData } = await supabase
            .from("submissions")
            .select("id, requirement_code, status, submitted_at")
            .eq("faculty_profile_id", appUser.profile_id)
            .order("submitted_at", { ascending: false });
          rawSubmissions = (fallbackData as typeof rawSubmissions) || [];
        } else if (data) {
          rawSubmissions = data as typeof rawSubmissions;
        }
      } catch (queryErr) {
        logger.error("status_submissions_query_exception", {
          error: queryErr instanceof Error ? queryErr.message : String(queryErr),
        });
      }
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
      remarks: s.remarks,
      document_versions: docVersionsMap.get(s.id) || [],
      review_decisions: reviewDecisionsMap.get(s.id) || [],
    }));

    // 6. Map requirement statuses safely
    const statusMap = new Map<string, RequirementStatus>();
    for (const code of DEFAULT_REQUIREMENTS) {
      statusMap.set(code, {
        code,
        status: "Not Submitted",
      });
    }

    for (const submission of submissions || []) {
      if (!submission || typeof submission !== "object") continue;
      const code = submission.requirement_code;
      if (!code || !isRequirementCode(code)) continue;
      if (!hasDocumentVersion(submission)) continue;
      if (statusMap.get(code)?.status !== "Not Submitted") continue;

      const reviews = Array.isArray(submission.review_decisions)
        ? submission.review_decisions
        : [];
      const latestReview = reviews[0];

      let status: "Validated" | "Rejected" | "Pending" | "Not Submitted" =
        "Not Submitted";

      if (submission.status === "validated" || latestReview?.decision === "validated") {
        status = "Validated";
      } else if (submission.status === "rejected" || latestReview?.decision === "rejected") {
        status = "Rejected";
      } else {
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
    const counts = {
      total: requirementStatuses.length,
      validated: requirementStatuses.filter((r) => r.status === "Validated").length,
      rejected: requirementStatuses.filter((r) => r.status === "Rejected").length,
      pending: requirementStatuses.filter((r) => r.status === "Pending").length,
      notSubmitted: requirementStatuses.filter((r) => r.status === "Not Submitted").length,
    };

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
    const defaultRequirementStatuses: RequirementStatus[] = DEFAULT_REQUIREMENTS.map(
      (code) => ({
        code,
        status: "Not Submitted" as const,
      }),
    );
    return NextResponse.json(
      {
        requirementStatuses: defaultRequirementStatuses,
        counts: {
          total: defaultRequirementStatuses.length,
          validated: 0,
          rejected: 0,
          pending: 0,
          notSubmitted: defaultRequirementStatuses.length,
        },
        message: "Internal server error handled gracefully",
      },
      { status: 200 },
    );
  }
}
