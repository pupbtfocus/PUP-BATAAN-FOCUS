export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
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
  faculty_assignment_id?: string | null;
  document_versions?: Array<{ id: string }> | null;
  review_decisions?: ReviewDecision[] | null;
};

function isRequirementCode(value: string): value is RequirementCode {
  return (DEFAULT_REQUIREMENTS as readonly string[]).includes(value);
}

function hasDocumentVersion(submission: {
  id?: string;
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  if (
    Array.isArray(submission.document_versions) &&
    submission.document_versions.length > 0
  ) {
    return true;
  }
  return Boolean(submission.id);
}

function isMissingRemarksColumnError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return message.includes("remarks") && message.includes("submissions");
}

function normalizeSemester(sem?: string | null): string {
  if (!sem) return "";
  const s = sem.toLowerCase().trim().replace(/[-_]/g, " ");
  if (s.includes("1") || s.includes("first") || s.includes("1st")) return "1st semester";
  if (s.includes("2") || s.includes("second") || s.includes("2nd")) return "2nd semester";
  if (s.includes("3") || s.includes("third") || s.includes("3rd") || s.includes("summer")) return "3rd semester";
  return s;
}

function normalizeAcademicYear(ay?: string | null): string {
  if (!ay) return "";
  return ay.toLowerCase().trim().replace(/^s\.?y\.?\s*/i, "").replace(/^a\.?y\.?\s*/i, "");
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

    const url = new URL(request.url);
    const requestedAcademicYear = (
      url.searchParams.get("academicYear") ||
      request.nextUrl?.searchParams?.get("academicYear")
    )?.trim();
    const requestedSemester = (
      url.searchParams.get("semester") ||
      request.nextUrl?.searchParams?.get("semester")
    )?.trim();

    const { data: dbCurrentTerm } = await supabase
      .from("academic_terms")
      .select("id, academic_year, semester")
      .eq("status", "Current")
      .maybeSingle();

    const activeAcademicYear =
      requestedAcademicYear ||
      dbCurrentTerm?.academic_year ||
      windowState?.academicYear ||
      "2027-2028";

    const activeSemester = normalizeSemester(
      requestedSemester ||
      dbCurrentTerm?.semester ||
      windowState?.semester ||
      "1st Semester"
    );

    const normActiveYear = normalizeAcademicYear(activeAcademicYear);
    const normActiveSem = normalizeSemester(activeSemester);

    function matchRequirementCode(
      inputCode?: string | null,
      inputReqId?: string | null,
    ): RequirementCode | null {
      const candidates = [inputCode, inputReqId].filter(Boolean) as string[];
      for (const raw of candidates) {
        const s = raw.toLowerCase().trim().replace(/[-_\s]+/g, "");
        if (s.includes("gradesheet") || s.includes("grade"))
          return REQUIREMENT_CODE.GRADE_SHEET;
        if (s.includes("syllabus") || s.includes("enhancedsyllabus"))
          return REQUIREMENT_CODE.ENHANCED_SYLLABUS;
        if (s.includes("orientation") || s.includes("classorientation"))
          return REQUIREMENT_CODE.CLASS_ORIENTATION;
        if (s.includes("midterm") || s.includes("midtermpackage"))
          return REQUIREMENT_CODE.MIDTERM_PACKAGE;
        if (s.includes("final") || s.includes("finalpackage"))
          return REQUIREMENT_CODE.FINAL_PACKAGE;
        if (
          s.includes("classrecord") ||
          s.includes("records") ||
          s.includes("classrecords")
        )
          return REQUIREMENT_CODE.CLASS_RECORDS;
      }
      return null;
    }

    // 3. Multi-faculty ID lookup (Auth ID + Profile ID)
    const facultyIds = new Set<string>([user.id]);
    let appUser: { profile_id: string | null } | null = null;
    try {
      const { data, error } = await supabase
        .from("app_users")
        .select("profile_id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!error && data?.profile_id) {
        appUser = data;
        facultyIds.add(data.profile_id);
      }
    } catch (userQueryErr) {
      logger.error("app_user_query_exception", {
        error: userQueryErr instanceof Error ? userQueryErr.message : String(userQueryErr),
      });
    }

    try {
      const { data: profileRow } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (profileRow?.id) {
        facultyIds.add(profileRow.id);
      }
    } catch {}

    const facultyIdList = Array.from(facultyIds);

    const defaultRequirementStatuses: RequirementStatus[] = DEFAULT_REQUIREMENTS.map(
      (code) => ({
        code,
        status: "Not Submitted" as const,
      }),
    );

    // 4. Program assignments lookup (non-blocking if empty)
    let assignmentRows: Array<{ id: string; academic_year?: string; term?: string }> = [];
    try {
      const { data, error } = await supabase
        .from("faculty_program_assignments")
        .select("id, academic_year, term")
        .in("faculty_profile_id", facultyIdList);

      if (!error && Array.isArray(data)) {
        assignmentRows = data;
      }
    } catch (assignmentErr) {
      logger.warn("faculty_program_assignments_exception", {
        facultyIds: facultyIdList,
        error: assignmentErr instanceof Error ? assignmentErr.message : String(assignmentErr),
      });
    }

    const currentTermAssignments = assignmentRows.filter(
      (row) =>
        normalizeAcademicYear(row.academic_year) === normActiveYear &&
        normalizeSemester(row.term) === normActiveSem,
    );
    const currentAssignmentIds = currentTermAssignments.map((row) => row.id);

    // 5. Query submissions matching EITHER faculty profile ID or auth user ID
    let rawSubmissions: Array<{
      id: string;
      requirement_code?: string | null;
      requirement_id?: string | null;
      status: string | null;
      submitted_at?: string | null;
      remarks?: string | null;
      faculty_assignment_id?: string | null;
    }> = [];

    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, requirement_code, status, submitted_at, remarks, faculty_assignment_id",
        )
        .in("faculty_profile_id", facultyIdList)
        .order("submitted_at", { ascending: false });

      if (error && isMissingRemarksColumnError(error)) {
        const { data: fallbackData } = await supabase
          .from("submissions")
          .select(
            "id, requirement_code, status, submitted_at, faculty_assignment_id",
          )
          .in("faculty_profile_id", facultyIdList)
          .order("submitted_at", { ascending: false });
        rawSubmissions = (fallbackData as typeof rawSubmissions) || [];
      } else if (data) {
        rawSubmissions = data as typeof rawSubmissions;
      }
    } catch (queryErr) {
      logger.error("status_submissions_query_exception", {
        error:
          queryErr instanceof Error ? queryErr.message : String(queryErr),
      });
    }

    if (rawSubmissions.length === 0) {
      try {
        const { data: altData } = await supabase
          .from("submissions")
          .select(
            "id, requirement_code, status, submitted_at, faculty_assignment_id",
          )
          .in("faculty_id", facultyIdList)
          .order("submitted_at", { ascending: false });
        if (altData && altData.length > 0) {
          rawSubmissions = altData as typeof rawSubmissions;
        }
      } catch {}
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
      requirement_code: (s.requirement_code ||
        (s as { requirement_id?: string }).requirement_id ||
        "") as RequirementCode,
      status: s.status,
      submitted_at: s.submitted_at,
      remarks: s.remarks,
      faculty_assignment_id: s.faculty_assignment_id,
      document_versions: docVersionsMap.get(s.id) || [],
      review_decisions: reviewDecisionsMap.get(s.id) || [],
    }));

    // 6. Map requirement statuses safely, strictly scoped to active term
    const statusMap = new Map<string, RequirementStatus>();
    for (const code of DEFAULT_REQUIREMENTS) {
      statusMap.set(code, {
        code,
        status: "Not Submitted",
      });
    }

    const termFilteredSubmissions = (submissions || []).filter((sub) => {
      // 1. Primary Check: Match explicit academic_year and normalized semester columns if present
      const subSemDirect =
        (sub as { semester?: string; term?: string }).semester ||
        (sub as { term?: string }).term;
      const subAYDirect =
        (sub as { academic_year?: string; academicYear?: string })
          .academic_year ||
        (sub as { academicYear?: string }).academicYear;

      if (subAYDirect && subSemDirect) {
        return (
          normalizeAcademicYear(subAYDirect) === normActiveYear &&
          normalizeSemester(subSemDirect) === normActiveSem
        );
      }

      // 2. Secondary Check: Match faculty_assignment_id if present
      if (sub.faculty_assignment_id) {
        return (
          currentAssignmentIds.length > 0 &&
          currentAssignmentIds.includes(sub.faculty_assignment_id)
        );
      }

      // If requested term has explicit assignments configured or if sub belongs to another assignment, DO NOT bleed unassigned rows.
      if (currentAssignmentIds.length > 0) {
        return false;
      }

      // 3. Fallback for legacy unassigned rows ONLY if active term matches 2026-2027
      if (normActiveYear === "2026-2027" && sub.submitted_at) {
        const subTime = new Date(sub.submitted_at).getTime();

        if (!isNaN(subTime)) {
          if (currentWindowStart) {
            const winStart = new Date(currentWindowStart).getTime();
            const is2ndSemActive = normActiveSem === "2nd semester";

            if (subTime >= winStart) {
              return is2ndSemActive;
            } else {
              return !is2ndSemActive;
            }
          }

          const { academicYear: subAY, semester: subSem } =
            toAcademicYearAndSemester(sub.submitted_at);
          return (
            normalizeAcademicYear(subAY) === normActiveYear &&
            normalizeSemester(subSem) === normActiveSem
          );
        }
      }

      return false;
    });

    console.log("[DEBUG STATUS API]", {
      facultyIds: facultyIdList,
      academicYear: normActiveYear,
      semester: normActiveSem,
      foundSubmissionsCount: rawSubmissions?.length ?? 0,
      rawSubmissions,
      termFilteredCount: termFilteredSubmissions.length,
    });

    for (const submission of termFilteredSubmissions) {
      if (!submission || typeof submission !== "object") continue;
      const matchedCode = matchRequirementCode(
        submission.requirement_code,
        (submission as { requirement_id?: string }).requirement_id,
      );
      if (!matchedCode) continue;
      if (!hasDocumentVersion(submission)) continue;
      if (statusMap.get(matchedCode)?.status !== "Not Submitted") continue;

      const reviews = Array.isArray(submission.review_decisions)
        ? submission.review_decisions
        : [];
      const latestReview = reviews[0];

      const rawStatus = (submission.status || "").toLowerCase().trim();
      const latestDecision = (latestReview?.decision || "").toLowerCase().trim();

      let status: "Validated" | "Rejected" | "Pending" | "Not Submitted" =
        "Not Submitted";

      if (
        rawStatus === "validated" ||
        rawStatus === "approved" ||
        latestDecision === "validated" ||
        latestDecision === "approved"
      ) {
        status = "Validated";
      } else if (
        rawStatus === "rejected" ||
        latestDecision === "rejected"
      ) {
        status = "Rejected";
      } else if (
        rawStatus === "pending" ||
        rawStatus === "uploaded" ||
        rawStatus === "submitted" ||
        rawStatus === "under_review" ||
        rawStatus === "pending_review" ||
        !rawStatus
      ) {
        status = "Pending";
      } else {
        status = "Pending";
      }

      statusMap.set(matchedCode, {
        code: matchedCode,
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

    const normalizedSemLabel =
      activeSemester === "1st semester"
        ? "1st Semester"
        : activeSemester === "2nd semester"
          ? "2nd Semester"
          : activeSemester;

    return NextResponse.json({
      requirementStatuses,
      counts,
      academicYear: activeAcademicYear,
      semester: normalizedSemLabel,
      hasActiveSchedule: Boolean(windowState.isConfigured && windowState.isOpen),
      isLocked: !windowState.isOpen || !windowState.isConfigured,
      debug: {
        profileId: appUser?.profile_id || facultyIdList[0] || null,
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
