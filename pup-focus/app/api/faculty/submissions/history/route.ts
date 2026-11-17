export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  REQUIREMENT_CODE,
  type RequirementCode,
} from "@/config/compliance";
import { logger } from "@/lib/observability/logger";
import {
  getSubmissionWindow,
  normalizeSemester,
  type SubmissionWindowSemester,
} from "@/features/submissions/services/submission-window.service";

type HistoryStatus = "Pending" | "Validated" | "Rejected";

type HistorySubmission = {
  id: string;
  academicYear: string;
  semester: SubmissionWindowSemester;
  requirementCode: RequirementCode | string;
  status: HistoryStatus;
  submittedAt: string;
  updatedAt?: string;
  dateValidated?: string;
  note?: string;
  remarks?: string;
  admin_remarks?: string;
  adminRemarks?: string;
  feedback?: string;
  fileName?: string;
  storagePath?: string;
  reviewedAt?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
  classId?: string | null;
  class_id?: string | null;
  faculty_class?: {
    id: string;
    subject_code: string;
    description: string;
    units: number;
    section_code: string;
    is_archived?: boolean;
  } | null;
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
  updated_at?: string | null;
  created_at?: string | null;
  remarks?: string | null;
  admin_remarks?: string | null;
  notes?: string | null;
  is_read?: boolean | null;
  viewed_at?: string | null;
  file_name?: string | null;
  storage_path?: string | null;
  file_path?: string | null;
  faculty_assignment_id?: string | null;
  class_id?: string | null;
};

function normalizeRequirementCode(
  rawCode?: string | null,
  activeTemplateCodes: string[] = [],
): RequirementCode | string {
  if (!rawCode) return "document";
  const s = rawCode.toLowerCase().trim().replace(/[-_\s]+/g, "");
  for (const code of activeTemplateCodes) {
    const tplClean = code.toLowerCase().trim().replace(/[-_\s]+/g, "");
    if (s === tplClean || rawCode.toLowerCase().trim() === code.toLowerCase().trim()) {
      return code;
    }
  }
  if (s.includes("gradesheet") || s.includes("grade")) return REQUIREMENT_CODE.GRADE_SHEET;
  if (s.includes("syllabus") || s.includes("enhancedsyllabus")) return REQUIREMENT_CODE.ENHANCED_SYLLABUS;
  if (s.includes("orientation") || s.includes("classorientation")) return REQUIREMENT_CODE.CLASS_ORIENTATION;
  if (s.includes("midterm") || s.includes("midtermpackage")) return REQUIREMENT_CODE.MIDTERM_PACKAGE;
  if (s.includes("final") || s.includes("finalpackage")) return REQUIREMENT_CODE.FINAL_PACKAGE;
  if (s.includes("classrecord") || s.includes("records") || s.includes("classrecords")) return REQUIREMENT_CODE.CLASS_RECORDS;
  return rawCode;
}

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: SubmissionWindowSemester;
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
  const norm = (submissionStatus || "").toLowerCase();
  if (
    latestReview?.decision === "validated" ||
    norm === "validated" ||
    norm === "approved" ||
    norm === "compliant"
  ) {
    return "Validated";
  }

  if (
    latestReview?.decision === "rejected" ||
    norm === "rejected" ||
    norm === "returned" ||
    norm === "needs_revision" ||
    norm === "revision_required"
  ) {
    return "Rejected";
  }

  return "Pending";
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const filterAY = url.searchParams.get("academicYear")?.trim();
    const filterSem = url.searchParams.get("semester")?.trim();

    // 1. Authenticate user
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

    // 2. Resolve faculty profile_id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile?.id) {
      logger.warn("history_faculty_profile_missing", { authUserId: user.id });
      return NextResponse.json(
        {
          submissions: [],
          total: 0,
          message: "Faculty profile not found",
        },
        { status: 200 },
      );
    }

    const facultyIds = Array.from(new Set([user.id, profile.id]));
    const [windowConfig, termsRes, classesRes] = await Promise.all([
      getSubmissionWindow(supabase),
      supabase
        .from("academic_terms")
        .select("id, academic_year, semester, status"),
      supabase
        .from("faculty_classes")
        .select("id, academic_year, semester, academic_term_id, subject_code, description, units, section_code, is_archived")
        .in("faculty_profile_id", facultyIds),
    ]);

    const dbTerms = (termsRes.data ?? []) as Array<{
      id?: string;
      academic_year?: string;
      semester?: string;
      status?: string;
    }>;

    const currentDbTerm = dbTerms.find(
      (t) => (t.status || "").trim().toLowerCase() === "current",
    );
    const currentAcademicTerm =
      currentDbTerm?.academic_year && currentDbTerm?.semester
        ? {
            academicYear: currentDbTerm.academic_year,
            semester: normalizeSemester(currentDbTerm.semester),
          }
        : null;

    const activeWindowTerm =
      windowConfig?.academicYear && windowConfig?.semester
        ? {
            academicYear: windowConfig.academicYear,
            semester: normalizeSemester(windowConfig.semester),
          }
        : currentAcademicTerm;

    let activeTemplateCodes: string[] = [];
    try {
      const { data: tplRows } = await supabase
        .from("requirement_templates")
        .select("code")
        .eq("is_active", true);
      if (tplRows) {
        activeTemplateCodes = tplRows.map((r: any) => String(r.code || "")).filter(Boolean);
      }
    } catch {}

    // 3. Query submission records for this faculty member across all classes
    let rawSubmissions: SubmissionRow[] = [];
    try {
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select("*")
        .in("faculty_profile_id", facultyIds)
        .order("submitted_at", { ascending: false, nullsFirst: false });

      if (!subError && subData) {
        // Include archived past-semester submissions so Validation History preserves prior terms
        rawSubmissions = subData as SubmissionRow[];
      }
    } catch (queryErr) {
      logger.error("history_submissions_query_failed", {
        error: queryErr instanceof Error ? queryErr.message : String(queryErr),
      });
    }

    const academicTermById = new Map<
      string,
      { academicYear: string; semester: SubmissionWindowSemester }
    >();
    for (const t of dbTerms) {
      if (t.id && t.academic_year && t.semester) {
        academicTermById.set(t.id, {
          academicYear: t.academic_year,
          semester: normalizeSemester(t.semester),
        });
      }
    }

    const classTermMap = new Map<
      string,
      { academicYear: string; semester: SubmissionWindowSemester }
    >();
    const classDetailsMap = new Map<
      string,
      {
        id: string;
        subject_code: string;
        description: string;
        units: number;
        section_code: string;
        is_archived?: boolean;
      }
    >();
    for (const c of (classesRes.data ?? []) as Array<any>) {
      if (!c?.id) continue;
      classDetailsMap.set(c.id, {
        id: c.id,
        subject_code: c.subject_code || "Subject",
        description: c.description || "Course Load",
        units: Number(c.units ?? 3),
        section_code: c.section_code || "Section",
        is_archived: Boolean(c.is_archived),
      });
      if (c.academic_year && c.semester) {
        classTermMap.set(c.id, {
          academicYear: c.academic_year,
          semester: normalizeSemester(c.semester),
        });
      } else if (c.academic_term_id && academicTermById.has(c.academic_term_id)) {
        classTermMap.set(c.id, academicTermById.get(c.academic_term_id)!);
      }
    }

    // Program assignments term mapping
    const { data: assignments } = await supabase
      .from("faculty_program_assignments")
      .select("id, academic_year, term")
      .in("faculty_profile_id", facultyIds);

    const assignmentMap = new Map<
      string,
      { academicYear: string; semester: SubmissionWindowSemester }
    >();
    if (assignments) {
      for (const a of assignments) {
        if (a.id && a.academic_year) {
          assignmentMap.set(a.id, {
            academicYear: a.academic_year,
            semester: normalizeSemester(a.term),
          });
        }
      }
    }

    const submissionIds = rawSubmissions.map((s) => s.id);

    // 4. Query matching review_decisions and document_versions
    const docVersionsMap = new Map<
      string,
      { storage_path?: string; mime_type?: string }
    >();
    const reviewDecisionsMap = new Map<string, ReviewDecision[]>();

    if (submissionIds.length > 0) {
      try {
        const { data: docVersions } = await supabase
          .from("document_versions")
          .select("submission_id, storage_path, mime_type")
          .in("submission_id", submissionIds)
          .order("version_number", { ascending: false });

        if (docVersions) {
          for (const doc of docVersions) {
            if (!docVersionsMap.has(doc.submission_id)) {
              docVersionsMap.set(doc.submission_id, {
                storage_path: doc.storage_path,
                mime_type: doc.mime_type,
              });
            }
          }
        }
      } catch {
        // document_versions table not available
      }

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
            const dec = (v.decision || v.status || "validated").toLowerCase() as
              | "validated"
              | "rejected";
            list.push({
              decision: dec === "rejected" ? "rejected" : "validated",
              remarks: v.remarks,
              created_at: v.created_at,
            });
            reviewDecisionsMap.set(v.submission_id, list);
          }
        }
      } catch {
        // verification_history is optional
      }
    }

    // 5. Map and attach decisions to each submission item
    const history: HistorySubmission[] = [];
    for (const row of rawSubmissions) {
      if (!row || !row.requirement_code) continue;

      const doc = docVersionsMap.get(row.id);
      const storagePath = doc?.storage_path || row.storage_path || row.file_path;
      const rawSt = (row.status || "").toLowerCase().trim();
      const hasFile = Boolean(
        row.submitted_at ||
        storagePath ||
        row.file_name ||
        rawSt === "uploaded" ||
        rawSt === "submitted" ||
        rawSt === "under_review" ||
        rawSt === "pending_review" ||
        rawSt === "validated" ||
        rawSt === "approved" ||
        rawSt === "rejected",
      );
      if (!hasFile) continue;

      const normCode = normalizeRequirementCode(
        row.requirement_code,
        activeTemplateCodes,
      );

      const reviews = reviewDecisionsMap.get(row.id) || [];
      const sortedReviews = [...reviews].sort((a, b) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      });
      const latestReviewWithRemarks = sortedReviews.find(
        (r) => r.remarks && r.remarks.trim() !== "",
      );
      const latestReview = sortedReviews[0];

      let term = assignmentMap.get(row.faculty_assignment_id || "");

      if (!term && (row as any).class_id) {
        term = classTermMap.get((row as any).class_id);
      }

      if (!term && activeWindowTerm) {
        term = activeWindowTerm;
      }

      if (!term) {
        term = toAcademicYearAndSemester(row.submitted_at || row.created_at);
      }

      const matchedClassDetails = (row as any).class_id
        ? classDetailsMap.get((row as any).class_id) || null
        : null;

      // Review feedback resolution from decisions or submission records
      const adminFeedback =
        latestReviewWithRemarks?.remarks?.trim() ||
        latestReview?.remarks?.trim() ||
        row.admin_remarks?.trim() ||
        undefined;

      const rawFacultyNote =
        (row as { notes?: string }).notes?.trim() ||
        (typeof row.remarks === "string" && row.remarks.trim() ? row.remarks.trim() : undefined);

      const facultyNote = rawFacultyNote || undefined;

      const fileName =
        row.file_name || (storagePath ? storagePath.split("/").pop() : undefined);

      const dateValidated =
        (latestReviewWithRemarks || latestReview)?.created_at ||
        row.updated_at ||
        row.submitted_at ||
        row.created_at ||
        new Date().toISOString();

      const resolvedStatus = toHistoryStatus(row.status, latestReview);

      history.push({
        id: row.id,
        academicYear: term.academicYear,
        semester: term.semester,
        requirementCode: normCode,
        status: resolvedStatus,
        submittedAt:
          row.submitted_at || row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || undefined,
        dateValidated: dateValidated,
        note: facultyNote,
        remarks: facultyNote,
        admin_remarks: adminFeedback,
        adminRemarks: adminFeedback,
        feedback: adminFeedback,
        fileName: fileName || undefined,
        storagePath: storagePath || undefined,
        classId: (row as any).class_id || undefined,
        class_id: (row as any).class_id || undefined,
        faculty_class: matchedClassDetails,
        reviewedAt: (latestReviewWithRemarks || latestReview)?.created_at
          ? new Date((latestReviewWithRemarks || latestReview)!.created_at!)
              .toISOString()
              .split("T")[0]
          : undefined,
        is_read: Boolean(row.is_read),
        isViewed: Boolean(row.is_read),
        viewed_at: row.viewed_at || undefined,
      });
    }

    const SEMESTER_SORT_ORDER: Record<string, number> = {
      "1st Semester": 1,
      "2nd Semester": 2,
      "Summer Semester": 3,
    };
    const termsByYear: Record<string, SubmissionWindowSemester[]> = {};
    const registerTerm = (ay?: string | null, sem?: string | null) => {
      if (!ay || !sem) return;
      const normalizedSem = normalizeSemester(sem);
      if (!termsByYear[ay]) termsByYear[ay] = [];
      if (!termsByYear[ay].includes(normalizedSem)) {
        termsByYear[ay].push(normalizedSem);
      }
    };

    dbTerms.forEach((t) => registerTerm(t.academic_year, t.semester));
    (assignments ?? []).forEach((a) => registerTerm(a.academic_year, a.term));
    if (activeWindowTerm) {
      registerTerm(activeWindowTerm.academicYear, activeWindowTerm.semester);
    }
    history.forEach((item) => registerTerm(item.academicYear, item.semester));

    Object.keys(termsByYear).forEach((ay) => {
      termsByYear[ay].sort(
        (a, b) => (SEMESTER_SORT_ORDER[a] ?? 99) - (SEMESTER_SORT_ORDER[b] ?? 99),
      );
    });
    const availableAcademicYears = Object.keys(termsByYear).sort((a, b) =>
      b.localeCompare(a),
    );

    const filteredHistory = history.filter((item) => {
      if (filterAY && filterAY !== "All" && item.academicYear !== filterAY) {
        return false;
      }
      if (filterSem && filterSem !== "All" && item.semester !== filterSem) {
        return false;
      }
      return true;
    });

    return NextResponse.json({
      submissions: filteredHistory,
      total: filteredHistory.length,
      availableAcademicYears,
      termsByYear,
      currentAcademicTerm: currentAcademicTerm ?? activeWindowTerm ?? null,
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
