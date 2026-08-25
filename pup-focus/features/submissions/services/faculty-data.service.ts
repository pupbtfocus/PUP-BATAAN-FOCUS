import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { FACULTY_PROFILE_IMAGE_BUCKET } from "@/lib/faculty-profile";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  type RequirementCode,
} from "@/config/compliance";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getSubmissionWindow,
  normalizeSemester,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";
import { logger } from "@/lib/observability/logger";

export type RequirementStatusData = {
  code: RequirementCode | string;
  status: "Validated" | "Rejected" | "Pending" | "Not Submitted";
  reviewedAt?: string;
  feedback?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
  note?: string | null;
  remarks?: string;
  submittedAt?: string;
  latestSubmissionId?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
};

export type RequirementTemplateData = {
  code: string;
  title: string;
  is_mandatory: boolean;
  max_size_mb: number;
  allowed_formats: string[];
};

export type StatusCountsData = {
  total: number;
  validated: number;
  rejected: number;
  pending: number;
  notSubmitted: number;
};

export type SubmissionWindowStateData = {
  isConfigured: boolean;
  isOpen: boolean;
  status: "Upcoming" | "Open" | "Closed";
  today: string;
  currentTime: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  academicYear: string | null;
  semester: "1st Semester" | "2nd Semester" | null;
  startTimeLabel?: string | null;
  endTimeLabel?: string | null;
  currentTimeLabel?: string | null;
};

export type PastSubmissionData = {
  id: string;
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
  requirementCode: RequirementCode | string;
  status: "Pending" | "Validated" | "Rejected";
  submittedAt: string;
  updatedAt?: string;
  dateValidated?: string;
  note?: string;
  remarks?: string;
  admin_remarks?: string;
  adminRemarks?: string | null;
  feedback?: string;
  reviewedAt?: string;
  is_read?: boolean;
  isViewed?: boolean;
  viewed_at?: string;
};

export type FacultyInitialData = {
  requirementStatuses: RequirementStatusData[];
  requirementTemplates: RequirementTemplateData[];
  counts: StatusCountsData;
  academicYear: string;
  semester: "1st Semester" | "2nd Semester";
  submissionWindow: SubmissionWindowStateData;
  pastSubmissions: PastSubmissionData[];
  hasActiveSchedule: boolean;
  isLocked: boolean;
  department?: string | null;
  program?: {
    id: string;
    code: string;
    name: string;
  } | null;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
};

function normalizeAcademicYear(ay?: string | null): string {
  if (!ay) return "";
  return ay.toLowerCase().trim().replace(/^s\.?y\.?\s*/i, "").replace(/^a\.?y\.?\s*/i, "");
}

function matchRequirementCode(
  inputCode?: string | null,
  inputReqId?: string | null,
  templateRows: RequirementTemplateData[] = [],
): string | null {
  const candidates = [inputCode, inputReqId].filter(Boolean) as string[];
  for (const raw of candidates) {
    const s = raw.toLowerCase().trim().replace(/[-_\s]+/g, "");
    for (const tpl of templateRows) {
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

export async function getFacultyInitialData(
  authUserId: string,
  requestedAcademicYear?: string,
  requestedSemester?: string,
): Promise<FacultyInitialData> {
  const supabase = getServiceRoleClient();

  // 1. Submission Window
  let windowConfig = null;
  try {
    windowConfig = await getSubmissionWindow(supabase);
  } catch (err) {
    logger.warn("faculty_data_submission_window_failed", { error: String(err) });
  }
  const evaluatedWindow = evaluateSubmissionWindow(windowConfig);

  const submissionWindow: SubmissionWindowStateData = {
    ...evaluatedWindow,
    semester: (evaluatedWindow.semester as "1st Semester" | "2nd Semester") || null,
    startTimeLabel: evaluatedWindow.startTime
      ? format24HourTo12Hour(evaluatedWindow.startTime)
      : null,
    endTimeLabel: evaluatedWindow.endTime
      ? format24HourTo12Hour(evaluatedWindow.endTime)
      : null,
    currentTimeLabel: format24HourTo12Hour(evaluatedWindow.currentTime),
  };

  // 2. Active Term
  const { data: dbCurrentTerm } = await supabase
    .from("academic_terms")
    .select("id, academic_year, semester")
    .eq("status", "Current")
    .maybeSingle();

  const activeAcademicYear =
    requestedAcademicYear ||
    dbCurrentTerm?.academic_year ||
    evaluatedWindow?.academicYear ||
    "2026-2027";

  const rawSem =
    requestedSemester ||
    dbCurrentTerm?.semester ||
    evaluatedWindow?.semester ||
    "1st Semester";

  const activeSemester: "1st Semester" | "2nd Semester" =
    normalizeSemester(rawSem).includes("2") ? "2nd Semester" : "1st Semester";

  const normActiveYear = normalizeAcademicYear(activeAcademicYear);
  const normActiveSem = normalizeSemester(activeSemester);

  // 3. Requirement Templates
  let activeTemplates: RequirementTemplateData[] = DEFAULT_REQUIREMENTS.map((code) => ({
    code,
    title: code,
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
      activeTemplates = dbTemplates.map((t) => ({
        code: t.code,
        title: t.title,
        is_mandatory: t.is_mandatory,
        max_size_mb: t.max_size_mb || 10,
        allowed_formats: t.allowed_formats || ["PDF", "DOCX", "XLSX"],
      }));
    }
  } catch {}

  // 4. Faculty Profile IDs & Avatar URL
  const facultyIds = new Set<string>([authUserId]);
  let avatarUrl: string | null = null;
  try {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (profileRow?.id) {
      facultyIds.add(profileRow.id);
    }

    const { data: authUserResult } = await supabase.auth.admin.getUserById(authUserId);
    const meta = (authUserResult?.user?.user_metadata || {}) as Record<string, unknown>;
    const profileImagePath = (meta.profile_image_path as string) || null;
    const profileImageBucket =
      (meta.profile_image_bucket as string) || FACULTY_PROFILE_IMAGE_BUCKET;

    if (profileImagePath) {
      const { data: signed } = await supabase.storage
        .from(profileImageBucket)
        .createSignedUrl(profileImagePath, 60 * 60);
      if (signed?.signedUrl) {
        avatarUrl = signed.signedUrl;
      }
    } else if (meta.avatar_url || meta.profile_image_url) {
      avatarUrl = (meta.avatar_url || meta.profile_image_url) as string;
    }
  } catch {}

  const facultyIdList = Array.from(facultyIds);

  // 5. Program Assignments
  let assignmentRows: Array<{ id: string; academic_year?: string; term?: string }> = [];
  let programInfo: { id: string; code: string; name: string } | null = null;
  let departmentName: string | null = null;
  try {
    const { data } = await supabase
      .from("faculty_program_assignments")
      .select("id, academic_year, term, program_id, programs(id, code, name)")
      .in("faculty_profile_id", facultyIdList);

    if (Array.isArray(data)) {
      assignmentRows = data;
      for (const row of data) {
        const p = (row as any).programs;
        const prog = Array.isArray(p) ? p[0] : p;
        if (prog?.code && prog?.name) {
          programInfo = {
            id: prog.id,
            code: prog.code,
            name: prog.name,
          };
          departmentName = `${prog.code} — ${prog.name}`;
          break;
        }
      }
    }
  } catch {}

  const currentTermAssignments = assignmentRows.filter(
    (row) =>
      normalizeAcademicYear(row.academic_year) === normActiveYear &&
      normalizeSemester(row.term) === normActiveSem,
  );
  const currentAssignmentIds = currentTermAssignments.map((row) => row.id);

  // 6. Submissions
  let rawSubmissions: Array<{
    id: string;
    requirement_code?: string | null;
    requirement_id?: string | null;
    status: string | null;
    submitted_at?: string | null;
    created_at?: string | null;
    remarks?: string | null;
    admin_remarks?: string | null;
    is_read?: boolean | null;
    viewed_at?: string | null;
    faculty_assignment_id?: string | null;
  }> = [];

  try {
    const { data } = await supabase
      .from("submissions")
      .select("id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks, is_read, viewed_at, faculty_assignment_id")
      .in("faculty_profile_id", facultyIdList)
      .order("submitted_at", { ascending: false });

    if (data) rawSubmissions = data;
  } catch {}

  const submissionIds = rawSubmissions.map((s) => s.id);

  // 7. Review Decisions
  const reviewDecisionsMap = new Map<
    string,
    Array<{ decision: "validated" | "rejected"; remarks?: string | null; created_at?: string | null }>
  >();

  if (submissionIds.length > 0) {
    try {
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
    } catch {}
  }

  // 8. Map Active Term Statuses
  const statusMap = new Map<string, RequirementStatusData>();
  for (const tpl of activeTemplates) {
    statusMap.set(tpl.code, {
      code: tpl.code,
      status: "Not Submitted",
    });
  }

  const termFilteredSubmissions = rawSubmissions.filter((sub) => {
    if (sub.faculty_assignment_id && currentAssignmentIds.length > 0) {
      return currentAssignmentIds.includes(sub.faculty_assignment_id);
    }
    return currentAssignmentIds.length === 0;
  });

  for (const sub of termFilteredSubmissions) {
    const matchedCode = matchRequirementCode(
      sub.requirement_code,
      sub.requirement_id,
      activeTemplates,
    );
    if (!matchedCode) continue;
    if (statusMap.get(matchedCode)?.status !== "Not Submitted") continue;

    const reviews = reviewDecisionsMap.get(sub.id) || [];
    const latestReview = reviews[0];
    const latestReviewWithRemarks = reviews.find((r) => r.remarks && r.remarks.trim() !== "");

    const rawStatus = (sub.status || "").toLowerCase().trim();
    const latestDecision = (latestReview?.decision || "").toLowerCase().trim();

    let status: "Validated" | "Rejected" | "Pending" | "Not Submitted" = "Pending";
    if (rawStatus === "validated" || rawStatus === "approved" || latestDecision === "validated") {
      status = "Validated";
    } else if (rawStatus === "rejected" || latestDecision === "rejected") {
      status = "Rejected";
    }

    const adminFeedback =
      latestReviewWithRemarks?.remarks?.trim() ||
      latestReview?.remarks?.trim() ||
      sub.admin_remarks?.trim() ||
      undefined;

    statusMap.set(matchedCode, {
      code: matchedCode,
      status,
      reviewedAt: (latestReviewWithRemarks || latestReview)?.created_at
        ? new Date((latestReviewWithRemarks || latestReview)!.created_at!).toISOString().split("T")[0]
        : undefined,
      feedback: adminFeedback,
      admin_remarks: adminFeedback,
      adminRemarks: adminFeedback,
      note: sub.remarks || undefined,
      remarks: adminFeedback,
      submittedAt: sub.submitted_at || sub.created_at || undefined,
      latestSubmissionId: sub.id,
      is_read: Boolean(sub.is_read),
      isViewed: Boolean(sub.is_read),
      viewed_at: sub.viewed_at || undefined,
    });
  }

  const requirementStatuses = Array.from(statusMap.values());
  const counts: StatusCountsData = {
    total: requirementStatuses.length,
    validated: requirementStatuses.filter((r) => r.status === "Validated").length,
    rejected: requirementStatuses.filter((r) => r.status === "Rejected").length,
    pending: requirementStatuses.filter((r) => r.status === "Pending").length,
    notSubmitted: requirementStatuses.filter((r) => r.status === "Not Submitted").length,
  };

  // 9. Historical Submissions (Validated / Approved only)
  const pastSubmissions: PastSubmissionData[] = [];
  for (const row of rawSubmissions) {
    if (!row || !row.requirement_code) continue;

    const rawSt = (row.status || "").toLowerCase().trim();
    const reviews = reviewDecisionsMap.get(row.id) || [];
    const latestReview = reviews[0];
    const latestReviewWithRemarks = reviews.find((r) => r.remarks && r.remarks.trim() !== "");

    if (
      latestReview?.decision !== "validated" &&
      rawSt !== "validated" &&
      rawSt !== "approved"
    ) {
      continue;
    }

    const adminFeedback =
      latestReviewWithRemarks?.remarks?.trim() ||
      latestReview?.remarks?.trim() ||
      row.admin_remarks?.trim() ||
      undefined;

    const dateValidated =
      (latestReviewWithRemarks || latestReview)?.created_at ||
      (row as any).updated_at ||
      row.submitted_at ||
      row.created_at ||
      new Date().toISOString();

    pastSubmissions.push({
      id: row.id,
      academicYear: activeAcademicYear,
      semester: activeSemester,
      requirementCode: row.requirement_code,
      status: "Validated",
      submittedAt: row.submitted_at || row.created_at || new Date().toISOString(),
      updatedAt: (row as any).updated_at || undefined,
      dateValidated,
      note: row.remarks?.trim() || undefined,
      remarks: adminFeedback,
      admin_remarks: adminFeedback,
      adminRemarks: adminFeedback,
      feedback: adminFeedback,
      reviewedAt: (latestReviewWithRemarks || latestReview)?.created_at
        ? new Date((latestReviewWithRemarks || latestReview)!.created_at!).toISOString().split("T")[0]
        : undefined,
      is_read: Boolean(row.is_read),
      isViewed: Boolean(row.is_read),
      viewed_at: row.viewed_at || undefined,
    });
  }

  return {
    requirementStatuses,
    requirementTemplates: activeTemplates,
    counts,
    academicYear: activeAcademicYear,
    semester: activeSemester,
    submissionWindow,
    pastSubmissions,
    hasActiveSchedule: Boolean(submissionWindow.isConfigured && submissionWindow.isOpen),
    isLocked: !submissionWindow.isOpen || !submissionWindow.isConfigured,
    department: departmentName,
    program: programInfo,
    avatarUrl,
    profileImageUrl: avatarUrl,
  };
}
