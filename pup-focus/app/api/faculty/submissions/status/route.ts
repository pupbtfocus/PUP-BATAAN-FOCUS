export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
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
  status:
    | "Validated"
    | "Rejected"
    | "Pending"
    | "Not Submitted"
    | "Exempted"
    | "Overdue"
    | "Extended";
  reviewedAt?: string;
  feedback?: string;
  admin_remarks?: string;
  adminRemarks?: string;
  note?: string;
  remarks?: string;
  submittedAt?: string;
  latestSubmissionId?: string;
  storagePath?: string;
  fileName?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
  isRevision?: boolean;
  hasPriorRevision?: boolean;
  due_at?: string | null;
  customDueDate?: string | null;
  effectiveDeadline?: string | null;
  isExtended?: boolean;
  extendedUntil?: string | null;
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
  due_at?: string | null;
  submitted_at?: string | null;
  remarks?: string | null;
  admin_remarks?: string | null;
  adminRemarks?: string | null;
  is_read?: boolean | null;
  viewed_at?: string | null;
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

    const url = new URL(request.url);
    const requestedAcademicYear = (
      url.searchParams.get("academicYear") ||
      request.nextUrl?.searchParams?.get("academicYear")
    )?.trim();
    const requestedSemester = (
      url.searchParams.get("semester") ||
      request.nextUrl?.searchParams?.get("semester")
    )?.trim();

    // 2. Resolve currently active academic term strictly
    const { data: dbCurrentTerm } = await supabase
      .from("academic_terms")
      .select("id, academic_year, semester")
      .eq("status", "Current")
      .maybeSingle();

    let dbTerm = dbCurrentTerm;
    if (!dbTerm) {
      const { data: latestTerm } = await supabase
        .from("academic_terms")
        .select("id, academic_year, semester")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latestTerm) {
        dbTerm = latestTerm;
      }
    }

    const activeAcademicYear =
      requestedAcademicYear ||
      dbTerm?.academic_year ||
      "2026-2027";

    const activeSemester = normalizeSemester(
      requestedSemester ||
      dbTerm?.semester ||
      "1st Semester"
    );

    const normActiveYear = normalizeAcademicYear(activeAcademicYear);
    const normActiveSem = normalizeSemester(activeSemester);

    // 2.1 Safely evaluate submission window strictly scoped to the active Academic Term
    let windowState;
    try {
      const submissionWindow = await getSubmissionWindow(supabase, {
        academicYear: activeAcademicYear,
        semester: activeSemester,
      });
      windowState = evaluateSubmissionWindow(
        submissionWindow,
        undefined,
        undefined,
        { academicYear: activeAcademicYear, semester: activeSemester },
      );
    } catch (windowError) {
      logger.warn("submission_window_eval_failed", {
        error: windowError instanceof Error ? windowError.message : String(windowError),
      });
      windowState = evaluateSubmissionWindow(null, undefined, undefined, {
        academicYear: activeAcademicYear,
        semester: activeSemester,
      });
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

    // 2.1 Fetch active requirement templates
    let activeTemplateRows: Array<{
      code: string;
      title: string;
      is_mandatory: boolean;
      max_size_mb: number;
      allowed_formats: string[];
    }> = DEFAULT_REQUIREMENTS.map((code) => ({
      code,
      title: (REQUIREMENT_LABEL as Record<string, string>)[code] || code,
      is_mandatory: true,
      max_size_mb: 10,
      allowed_formats: ["PDF", "DOCX", "XLSX"],
    }));

    try {
      const { data: dbTemplates } = await supabase
        .from("requirement_templates")
        .select("code, title, is_mandatory, max_size_mb, allowed_formats, is_active")
        .eq("is_active", true)
        .order("is_mandatory", { ascending: false })
        .order("created_at", { ascending: true });

      if (dbTemplates && dbTemplates.length > 0) {
        activeTemplateRows = dbTemplates.map((t) => ({
          code: t.code,
          title: t.title,
          is_mandatory: t.is_mandatory,
          max_size_mb: t.max_size_mb || 5,
          allowed_formats: t.allowed_formats || ["PDF"],
        }));
      }
    } catch {
      // Keep defaults
    }

    function matchRequirementCode(
      inputCode?: string | null,
      inputReqId?: string | null,
    ): string | null {
      const candidates = [inputCode, inputReqId].filter(Boolean) as string[];
      for (const raw of candidates) {
        const s = raw.toLowerCase().trim().replace(/[-_\s]+/g, "");
        for (const tpl of activeTemplateRows) {
          const tplClean = tpl.code.toLowerCase().trim().replace(/[-_\s]+/g, "");
          if (s === tplClean || s === tpl.code.toLowerCase()) {
            return tpl.code;
          }
        }
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
    let profileRow: { id: string } | null = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.id) {
        profileRow = data;
        facultyIds.add(data.id);
      }
    } catch (userQueryErr) {
      logger.error("profile_query_exception", {
        error: userQueryErr instanceof Error ? userQueryErr.message : String(userQueryErr),
      });
    }

    const facultyIdList = Array.from(facultyIds);

    const defaultRequirementStatuses: RequirementStatus[] = activeTemplateRows.map(
      (tpl) => ({
        code: tpl.code,
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

    const assignmentMap = new Map<string, { academicYear: string; semester: string }>();
    for (const a of assignmentRows) {
      if (a.id) {
        assignmentMap.set(a.id, {
          academicYear: normalizeAcademicYear(a.academic_year),
          semester: normalizeSemester(a.term),
        });
      }
    }

    let currentTermAssignments = assignmentRows.filter(
      (row) =>
        normalizeAcademicYear(row.academic_year) === normActiveYear &&
        normalizeSemester(row.term) === normActiveSem,
    );

    // Onboarding check: ensure faculty has an active assignment for the active Academic Term
    if (currentTermAssignments.length === 0 && profileRow?.id) {
      const priorAssignment = assignmentRows.find((a: any) => (a as any).program_id);
      if (priorAssignment && (priorAssignment as any).program_id) {
        try {
          const { data: newAssignment } = await supabase
            .from("faculty_program_assignments")
            .upsert(
              {
                faculty_profile_id: profileRow.id,
                program_id: (priorAssignment as any).program_id,
                academic_year: activeAcademicYear,
                term: activeSemester,
              },
              { onConflict: "faculty_profile_id,program_id,academic_year,term" },
            )
            .select("id, academic_year, term")
            .single();

          if (newAssignment) {
            currentTermAssignments = [newAssignment];
            assignmentRows.push(newAssignment);
          }
        } catch {}
      }
    }

    const currentAssignmentIds = currentTermAssignments.map((row) => row.id);

    // 5. Query submissions matching EITHER faculty profile ID or auth user ID
    let rawSubmissions: Array<{
      id: string;
      requirement_code?: string | null;
      requirement_id?: string | null;
      status: string | null;
      due_at?: string | null;
      submitted_at?: string | null;
      remarks?: string | null;
      admin_remarks?: string | null;
      is_read?: boolean | null;
      viewed_at?: string | null;
      faculty_assignment_id?: string | null;
    }> = [];

    try {
      const { data, error } = await supabase
        .from("submissions")
        .select(
          "id, requirement_code, status, due_at, submitted_at, remarks, admin_remarks, is_read, viewed_at, faculty_assignment_id",
        )
        .or(
          `faculty_profile_id.in.(${facultyIdList.join(",")}),user_id.in.(${facultyIdList.join(",")}),created_by.in.(${facultyIdList.join(",")})`,
        )
        .order("submitted_at", { ascending: false });

      if (error) {
        // Fallback without is_read / viewed_at if columns don't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("submissions")
          .select(
            "id, requirement_code, status, due_at, submitted_at, remarks, admin_remarks, faculty_assignment_id",
          )
          .in("faculty_profile_id", facultyIdList)
          .order("submitted_at", { ascending: false });

        if (fallbackError) {
          const { data: minimalData } = await supabase
            .from("submissions")
            .select(
              "id, requirement_code, status, due_at, submitted_at, faculty_assignment_id",
            )
            .in("faculty_profile_id", facultyIdList)
            .order("submitted_at", { ascending: false });
          rawSubmissions = (minimalData as typeof rawSubmissions) || [];
        } else if (fallbackData) {
          rawSubmissions = fallbackData as typeof rawSubmissions;
        }
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
            "id, requirement_code, status, due_at, submitted_at, faculty_assignment_id",
          )
          .in("faculty_id", facultyIdList)
          .order("submitted_at", { ascending: false });
        if (altData && altData.length > 0) {
          rawSubmissions = altData as typeof rawSubmissions;
        }
      } catch {}
    }

    // 5.1 Query approved extension requests for this faculty user
    let approvedExtensions: any[] = [];
    try {
      const { data: extData } = await supabase
        .from("extension_requests")
        .select("*")
        .eq("faculty_user_id", user.id)
        .eq("status", "approved")
        .order("created_at", { ascending: false });

      if (extData && Array.isArray(extData)) {
        approvedExtensions = extData;
      }
    } catch {}

    if (approvedExtensions.length === 0) {
      try {
        const { data: notifs } = await supabase
          .from("notifications")
          .select("*")
          .eq("type", "EXTENSION_REQUEST")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (notifs) {
          for (const n of notifs) {
            try {
              const parsed = JSON.parse(n.message);
              if (parsed.status === "approved") {
                approvedExtensions.push(parsed);
              }
            } catch {}
          }
        }
      } catch {}
    }

    const submissionIds = rawSubmissions.map((s) => s.id);

    // Fetch document_versions separately
    const docVersionsMap = new Map<
      string,
      Array<{ id: string; storage_path?: string; mime_type?: string; file_name?: string }>
    >();
    if (submissionIds.length > 0) {
      try {
        const { data: docVersions } = await supabase
          .from("document_versions")
          .select("id, submission_id, storage_path, mime_type")
          .in("submission_id", submissionIds)
          .order("version_number", { ascending: false });

        if (docVersions) {
          for (const doc of docVersions) {
            const list = docVersionsMap.get(doc.submission_id) || [];
            list.push({
              id: doc.id,
              storage_path: doc.storage_path,
              mime_type: doc.mime_type,
              file_name: doc.storage_path ? doc.storage_path.split("/").pop() : undefined,
            });
            docVersionsMap.set(doc.submission_id, list);
          }
        }
      } catch {
        // document_versions table not available
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

      try {
        const { data: vHistory } = await supabase
          .from("verification_history")
          .select("submission_id, decision, status, remarks, created_at")
          .in("submission_id", submissionIds)
          .order("created_at", { ascending: false });

        if (vHistory) {
          for (const v of vHistory) {
            const list = reviewDecisionsMap.get(v.submission_id) || [];
            const dec = (v.decision || v.status || "validated").toLowerCase() as "validated" | "rejected";
            list.push({
              decision: dec === "rejected" ? "rejected" : "validated",
              remarks: v.remarks,
              created_at: v.created_at,
            });
            reviewDecisionsMap.set(v.submission_id, list);
          }
        }
      } catch {
        // verification_history optional
      }
    }

    const submissions: SubmissionRow[] = rawSubmissions.map((s) => ({
      id: s.id,
      requirement_code: (s.requirement_code ||
        (s as { requirement_id?: string }).requirement_id ||
        "") as RequirementCode,
      status: s.status,
      due_at: s.due_at,
      submitted_at: s.submitted_at,
      remarks: s.remarks,
      admin_remarks: s.admin_remarks,
      adminRemarks: s.admin_remarks,
      is_read: s.is_read,
      viewed_at: s.viewed_at,
      faculty_assignment_id: s.faculty_assignment_id,
      document_versions:
        docVersionsMap.get(s.id) ||
        (s.submitted_at || s.status === "uploaded" || s.status === "submitted" || s.status === "validated"
          ? [{ id: s.id, storage_path: `faculty-submissions/${profileRow?.id || user.id}/${s.id}` }]
          : []),
      review_decisions: reviewDecisionsMap.get(s.id) || [],
    }));

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
        const assigned = assignmentMap.get(sub.faculty_assignment_id);
        if (assigned) {
          return (
            assigned.academicYear === normActiveYear &&
            assigned.semester === normActiveSem
          );
        }
        if (
          currentAssignmentIds.length > 0 &&
          currentAssignmentIds.includes(sub.faculty_assignment_id)
        ) {
          return true;
        }
      }

      // 3. Fallback for submitted rows (match by submission date)
      if (sub.submitted_at) {
        const { academicYear: subAY, semester: subSem } =
          toAcademicYearAndSemester(sub.submitted_at);
        return (
          normalizeAcademicYear(subAY) === normActiveYear &&
          normalizeSemester(subSem) === normActiveSem
        );
      }

      // 4. Onboarding grace period rows: no submitted_at but have due_at set.
      //    Include them if they were created near the current active term (no semester/AY columns).
      //    These come from admin-assigned grace periods during new faculty onboarding.
      if (sub.due_at && !sub.submitted_at) {
        return true;
      }

      return false;
    });


    // 6. Map requirement statuses using Hard Deadline & Status Calculation rules
    const nowMs = Date.now();
    const globalDeadlineIso = localWindowEnd ? `${localWindowEnd}+08:00` : null;
    const globalDeadlineMs = globalDeadlineIso ? new Date(globalDeadlineIso).getTime() : null;

    const statusMap = new Map<string, RequirementStatus>();

    for (const tpl of activeTemplateRows) {
      const code = tpl.code;
      const submission = termFilteredSubmissions.find((s) => {
        const matched = matchRequirementCode(
          s.requirement_code,
          (s as { requirement_id?: string }).requirement_id,
        );
        return matched === code;
      });

      const hasDoc = submission ? hasDocumentVersion(submission) : false;
      const reviews = Array.isArray(submission?.review_decisions)
        ? [...submission.review_decisions].sort((a, b) => {
            const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return timeB - timeA;
          })
        : [];
      const latestReviewWithRemarks = reviews.find(
        (r) => r.remarks && r.remarks.trim() !== "",
      );
      const latestReview = reviews[0];

      const rawStatus = (submission?.status || "").toLowerCase().trim();
      const latestDecision = (latestReview?.decision || "").toLowerCase().trim();

      // Check approved extension request
      const matchingExt = approvedExtensions.find((ext) => {
        const matchAY = !ext.academic_year || normalizeAcademicYear(ext.academic_year) === normActiveYear;
        const matchSem = !ext.semester || normalizeSemester(ext.semester) === normActiveSem;
        if (!matchAY || !matchSem) return false;
        const reqCodes = Array.isArray(ext.requirement_codes) ? ext.requirement_codes : [];
        return reqCodes.length === 0 || reqCodes.includes(code);
      });

      const extDeadlineIso = matchingExt?.requested_date
        ? `${matchingExt.requested_date}T${matchingExt.requested_time ? normalizeTime24Hour(matchingExt.requested_time) || "23:59:59" : "23:59:59"}+08:00`
        : null;
      const extDeadlineMs = extDeadlineIso ? new Date(extDeadlineIso).getTime() : null;
      const isExtensionActive = Boolean(extDeadlineMs && nowMs <= extDeadlineMs);

      // Effective deadline determination:
      // Individual custom due date if one exists; otherwise, approved extension date or schedule's global deadline
      let effectiveDeadlineIso = globalDeadlineIso;
      let effectiveDeadlineMs = globalDeadlineMs;
      let customDueDate: string | null = null;

      if (isExtensionActive && extDeadlineIso && extDeadlineMs) {
        effectiveDeadlineIso = extDeadlineIso;
        effectiveDeadlineMs = extDeadlineMs;
        if (submission?.due_at) {
          customDueDate = submission.due_at;
        }
      } else if (submission?.due_at) {
        customDueDate = submission.due_at;
        const customIso = submission.due_at.includes("T") ? submission.due_at : `${submission.due_at}T23:59:59+08:00`;
        const customMs = new Date(customIso).getTime();
        if (!Number.isNaN(customMs)) {
          effectiveDeadlineIso = customIso;
          effectiveDeadlineMs = customMs;
        }
      } else if (extDeadlineIso && extDeadlineMs) {
        effectiveDeadlineIso = extDeadlineIso;
        effectiveDeadlineMs = extDeadlineMs;
      }

      const isPastEffectiveDeadline = Boolean(
        effectiveDeadlineMs && nowMs > effectiveDeadlineMs,
      );

      const isPendingUpload =
        rawStatus === "pending" ||
        rawStatus === "uploaded" ||
        rawStatus === "submitted" ||
        rawStatus === "under_review" ||
        rawStatus === "pending_review";

      const hasPriorRejection =
        latestDecision === "rejected" ||
        reviews.some((r) => (r.decision || "").toLowerCase() === "rejected");

      // Status Evaluation Rules:
      // 1. EXEMPTED: Display an "Exempted" badge. Disable both file uploads and extension requests.
      // 2. PENDING: Current date is on or before the effective deadline, and no file is submitted.
      // 3. OVERDUE: Current date is past the effective deadline, and no file is submitted.
      // 4. EXTENDED: Extension request approved, temporarily unlocked until approved extended date.
      let status: RequirementStatus["status"] = "Pending";

      if (rawStatus === "exempted" || rawStatus === "exempt") {
        status = "Exempted";
      } else if (
        hasDoc &&
        (rawStatus === "validated" ||
          rawStatus === "approved" ||
          latestDecision === "validated" ||
          latestDecision === "approved")
      ) {
        status = "Validated";
      } else if (hasDoc && isPendingUpload) {
        status = "Pending";
      } else if (hasDoc && (rawStatus === "rejected" || latestDecision === "rejected")) {
        status = "Rejected";
      } else if (!hasDoc || !submission) {
        if (isExtensionActive) {
          status = "Extended";
        } else if (isPastEffectiveDeadline) {
          status = "Overdue";
        } else {
          status = "Pending";
        }
      }

      const adminFeedback =
        latestReviewWithRemarks?.remarks?.trim() ||
        latestReview?.remarks?.trim() ||
        (submission as { admin_remarks?: string })?.admin_remarks?.trim() ||
        undefined;

      const rawFacultyNote =
        submission && "remarks" in submission && typeof submission.remarks === "string" && submission.remarks.trim()
          ? submission.remarks.trim()
          : undefined;

      const facultyNote = rawFacultyNote || undefined;
      const docList = submission ? docVersionsMap.get(submission.id) || [] : [];
      const primaryDoc = docList[0];
      const storagePath = primaryDoc?.storage_path;
      const fileName = primaryDoc?.file_name || (storagePath ? storagePath.split("/").pop() : undefined);
      const isRevision = Boolean((hasPriorRejection || docList.length > 1) && status === "Pending");

      statusMap.set(code, {
        code,
        status,
        reviewedAt: (latestReviewWithRemarks || latestReview)?.created_at
          ? new Date((latestReviewWithRemarks || latestReview)!.created_at!).toISOString().split("T")[0]
          : undefined,
        feedback: adminFeedback,
        admin_remarks: adminFeedback,
        adminRemarks: adminFeedback,
        note: facultyNote,
        remarks: facultyNote,
        submittedAt: submission?.submitted_at || undefined,
        latestSubmissionId: submission?.id,
        storagePath: storagePath || undefined,
        fileName: fileName || undefined,
        is_read: Boolean(submission?.is_read),
        isViewed: Boolean(submission?.is_read),
        viewed_at: submission?.viewed_at || undefined,
        isRevision,
        hasPriorRevision: isRevision || hasPriorRejection,
        due_at: submission?.due_at || null,
        customDueDate,
        effectiveDeadline: effectiveDeadlineIso,
        isExtended: isExtensionActive,
        extendedUntil: extDeadlineIso,
      });
    }

    const requirementStatuses = Array.from(statusMap.values());
    const counts = {
      total: requirementStatuses.length,
      validated: requirementStatuses.filter((r) => r.status === "Validated").length,
      rejected: requirementStatuses.filter((r) => r.status === "Rejected").length,
      pending: requirementStatuses.filter((r) => r.status === "Pending").length,
      overdue: requirementStatuses.filter((r) => r.status === "Overdue").length,
      extended: requirementStatuses.filter((r) => r.status === "Extended").length,
      exempted: requirementStatuses.filter((r) => r.status === "Exempted").length,
      notSubmitted: requirementStatuses.filter(
        (r) => r.status === "Pending" || r.status === "Overdue" || r.status === "Extended",
      ).length,
    };

    const normalizedSemLabel =
      activeSemester === "1st semester"
        ? "1st Semester"
        : activeSemester === "2nd semester"
          ? "2nd Semester"
          : activeSemester;

    const globalWindowLocked = !windowState.isOpen || !windowState.isConfigured;

    // isLocked should be false if the faculty has at least one requirement with an
    // active individual due_at (grace period from onboarding Option A), even when
    // the global submission window is closed.
    const hasActiveGracePeriod =
      globalWindowLocked &&
      requirementStatuses.some((r) => {
        if (!r.due_at) return false;
        const dueIso = r.due_at.includes("T") ? r.due_at : `${r.due_at}T23:59:59+08:00`;
        const dueMs = new Date(dueIso).getTime();
        return !Number.isNaN(dueMs) && nowMs <= dueMs;
      });

    return NextResponse.json({
      requirementStatuses,
      requirementTemplates: activeTemplateRows,
      counts,
      academicYear: activeAcademicYear,
      semester: normalizedSemLabel,
      hasActiveSchedule: Boolean(windowState.isConfigured && windowState.isOpen),
      isLocked: globalWindowLocked && !hasActiveGracePeriod,
      debug: {
        profileId: profileRow?.id || facultyIdList[0] || null,
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
