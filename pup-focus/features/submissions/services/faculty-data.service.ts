import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { FACULTY_PROFILE_IMAGE_BUCKET } from "@/lib/faculty-profile";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import {
  evaluateSubmissionWindow,
  format24HourTo12Hour,
  getFacultyPersonalDeadline,
  getSubmissionWindow,
  normalizeSemester,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";
import { logger } from "@/lib/observability/logger";

export type RequirementStatusData = {
  code: RequirementCode | string;
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
  adminRemarks?: string | null;
  note?: string | null;
  remarks?: string;
  submittedAt?: string;
  latestSubmissionId?: string;
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
  overdue?: number;
  extended?: number;
  exempted?: number;
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
  isGracePeriod?: boolean;
  isPersonalDeadline?: boolean;
  effectiveDeadline?: string | null;
  formattedDueAt?: string | null;
  badgeLabel?: string | null;
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
  hasActiveGracePeriod?: boolean;
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

  // 1. Resolve Active Academic Term strictly (only one can be designated active)
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

  const rawSem =
    requestedSemester ||
    dbTerm?.semester ||
    "1st Semester";

  const activeSemester: "1st Semester" | "2nd Semester" =
    normalizeSemester(rawSem).includes("2") ? "2nd Semester" : "1st Semester";

  const normActiveYear = normalizeAcademicYear(activeAcademicYear);
  const normActiveSem = normalizeSemester(activeSemester);

  // 2. Submission Window strictly scoped to the active Academic Term
  let windowConfig = null;
  try {
    windowConfig = await getSubmissionWindow(supabase, {
      academicYear: activeAcademicYear,
      semester: activeSemester,
    });
  } catch (err) {
    logger.warn("faculty_data_submission_window_failed", { error: String(err) });
  }
  const evaluatedWindow = evaluateSubmissionWindow(
    windowConfig,
    undefined,
    undefined,
    { academicYear: activeAcademicYear, semester: activeSemester },
  );

  const submissionWindow: SubmissionWindowStateData = {
    ...evaluatedWindow,
    academicYear: activeAcademicYear,
    semester: activeSemester,
    startTimeLabel: evaluatedWindow.startTime
      ? format24HourTo12Hour(evaluatedWindow.startTime)
      : null,
    endTimeLabel: evaluatedWindow.endTime
      ? format24HourTo12Hour(evaluatedWindow.endTime)
      : null,
    currentTimeLabel: format24HourTo12Hour(evaluatedWindow.currentTime),
  };

  // 3. Requirement Templates
  let activeTemplates: RequirementTemplateData[] = DEFAULT_REQUIREMENTS.map((code) => ({
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
  let facultyProfileId: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (profileRow?.id) {
      facultyProfileId = profileRow.id;
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

  let currentTermAssignments = assignmentRows.filter(
    (row) =>
      normalizeAcademicYear(row.academic_year) === normActiveYear &&
      normalizeSemester(row.term) === normActiveSem,
  );

  // Onboarding check: Ensure faculty has an active assignment for the active Academic Term
  const targetProfileId = facultyProfileId || facultyIdList[0];
  if (currentTermAssignments.length === 0 && programInfo?.id && targetProfileId) {
    try {
      const { data: newAssignment } = await supabase
        .from("faculty_program_assignments")
        .upsert(
          {
            faculty_profile_id: targetProfileId,
            program_id: programInfo.id,
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

  const currentAssignmentIds = currentTermAssignments.map((row) => row.id);

  // 6. Submissions
  let rawSubmissions: Array<{
    id: string;
    requirement_code?: string | null;
    requirement_id?: string | null;
    status: string | null;
    due_at?: string | null;
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
      .select("id, requirement_code, status, due_at, submitted_at, created_at, remarks, admin_remarks, is_read, viewed_at, faculty_assignment_id")
      .in("faculty_profile_id", facultyIdList)
      .order("submitted_at", { ascending: false });

    if (data) rawSubmissions = data;
  } catch {}

  const submissionIds = rawSubmissions.map((s) => s.id);

  // 6.1 Query approved extension requests for this faculty user
  let approvedExtensions: any[] = [];
  try {
    const { data: extData } = await supabase
      .from("extension_requests")
      .select("*")
      .eq("faculty_user_id", authUserId)
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
        .eq("user_id", authUserId)
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

  // 8. Map Active Term Statuses using Hard Deadline & Status Calculation rules
  const nowMs = Date.now();
  let personalDeadline = await getFacultyPersonalDeadline(supabase, authUserId);

  if (!personalDeadline && rawSubmissions.length > 0) {
    const futurePendingSubs = rawSubmissions.filter((s) => {
      if (!s.due_at) return false;
      const st = (s.status || "").toLowerCase().trim();
      if (st === "validated" || st === "approved" || st === "exempted") return false;
      let dueMs = new Date(s.due_at).getTime();
      if (Number.isNaN(dueMs)) {
        const iso = s.due_at.includes("T") ? s.due_at : `${s.due_at}T23:59:59+08:00`;
        dueMs = new Date(iso).getTime();
      }
      return !Number.isNaN(dueMs) && dueMs > nowMs;
    });

    if (futurePendingSubs.length > 0) {
      futurePendingSubs.sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
      const targetSub = futurePendingSubs[0];
      const iso = targetSub.due_at!.includes("T") ? targetSub.due_at! : `${targetSub.due_at!}T23:59:59+08:00`;
      const targetDate = new Date(targetSub.due_at!);
      const datePart = iso.split("T")[0];
      const dateStr = targetDate.toLocaleDateString("en-PH", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      });
      const timeStr = targetDate.toLocaleTimeString("en-PH", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Manila",
      });
      personalDeadline = {
        hasPersonalDeadline: true,
        effectiveDeadline: iso,
        formattedDueAt: `${dateStr} at ${timeStr}`,
        endDate: datePart,
      };
    }
  }

  if (!personalDeadline && approvedExtensions.length > 0) {
    for (const ext of approvedExtensions) {
      const extDate = ext.approved_extension_date || ext.requested_extension_date || ext.due_at;
      if (!extDate) continue;
      let dueMs = new Date(extDate).getTime();
      if (Number.isNaN(dueMs)) {
        const iso = extDate.includes("T") ? extDate : `${extDate}T23:59:59+08:00`;
        dueMs = new Date(iso).getTime();
      }
      if (!Number.isNaN(dueMs) && dueMs > nowMs) {
        const iso = extDate.includes("T") ? extDate : `${extDate}T23:59:59+08:00`;
        const targetDate = new Date(extDate);
        const datePart = iso.split("T")[0];
        const dateStr = targetDate.toLocaleDateString("en-PH", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "Asia/Manila",
        });
        const timeStr = targetDate.toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
          timeZone: "Asia/Manila",
        });
        personalDeadline = {
          hasPersonalDeadline: true,
          effectiveDeadline: iso,
          formattedDueAt: `${dateStr} at ${timeStr}`,
          endDate: datePart,
        };
        break;
      }
    }
  }

  const globalWindowLocked = !submissionWindow.isOpen || !submissionWindow.isConfigured;

  const globalDeadlineIso = submissionWindow.endDate
    ? `${submissionWindow.endDate}T${submissionWindow.endTime ? normalizeTime24Hour(submissionWindow.endTime) || "23:59:59" : "23:59:59"}+08:00`
    : null;
  const globalDeadlineMs = globalDeadlineIso ? new Date(globalDeadlineIso).getTime() : null;

  const statusMap = new Map<string, RequirementStatusData>();
  for (const tpl of activeTemplates) {
    statusMap.set(tpl.code, {
      code: tpl.code,
      status: "Pending",
    });
  }

  const termFilteredSubmissions = rawSubmissions.filter((sub) => {
    if (sub.faculty_assignment_id && currentAssignmentIds.length > 0) {
      return currentAssignmentIds.includes(sub.faculty_assignment_id);
    }
    return currentAssignmentIds.length === 0;
  });

  for (const tpl of activeTemplates) {
    const code = tpl.code;
    const sub = termFilteredSubmissions.find((s) => {
      const m = matchRequirementCode(s.requirement_code, s.requirement_id, activeTemplates);
      return m === code;
    });

    const reviews = sub ? reviewDecisionsMap.get(sub.id) || [] : [];
    const latestReview = reviews[0];
    const latestReviewWithRemarks = reviews.find((r) => r.remarks && r.remarks.trim() !== "");

    const rawStatus = (sub?.status || "").toLowerCase().trim();
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
    // Individual custom due date if one exists; otherwise, approved extension date, personal deadline, or schedule's global deadline
    let effectiveDeadlineIso = personalDeadline ? personalDeadline.effectiveDeadline : globalDeadlineIso;
    let effectiveDeadlineMs = personalDeadline ? new Date(personalDeadline.effectiveDeadline).getTime() : globalDeadlineMs;
    let customDueDate: string | null = null;

    if (isExtensionActive && extDeadlineIso && extDeadlineMs) {
      effectiveDeadlineIso = extDeadlineIso;
      effectiveDeadlineMs = extDeadlineMs;
      if (sub?.due_at) {
        customDueDate = sub.due_at;
      }
    } else if (sub?.due_at) {
      customDueDate = sub.due_at;
      const customIso = sub.due_at.includes("T") ? sub.due_at : `${sub.due_at}T23:59:59+08:00`;
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

    const hasActualFile = Boolean(
      sub?.submitted_at ||
      rawStatus === "uploaded" ||
      rawStatus === "submitted" ||
      rawStatus === "under_review" ||
      rawStatus === "pending_review" ||
      rawStatus === "validated" ||
      rawStatus === "approved",
    );

    const isSubmitted = hasActualFile;

    const isPendingReview = Boolean(
      hasActualFile &&
      (rawStatus === "pending" ||
       rawStatus === "uploaded" ||
       rawStatus === "submitted" ||
       rawStatus === "under_review" ||
       rawStatus === "pending_review")
    );

    const hasPriorRejection =
      latestDecision === "rejected" ||
      reviews.some((r) => (r.decision || "").toLowerCase() === "rejected");

    // Status evaluation rules:
    // 1. EXEMPTED: Display an "Exempted" badge. Disable both file uploads and extension requests.
    // 2. PENDING: Current date is on or before effective deadline, and no file is submitted.
    // 3. OVERDUE: Current date is past effective deadline, and no file is submitted.
    // 4. EXTENDED: Extension request approved, temporarily unlocked until approved date.
    let status: RequirementStatusData["status"] = "Pending";

    if (rawStatus === "exempted" || rawStatus === "exempt") {
      status = "Exempted";
    } else if (rawStatus === "validated" || rawStatus === "approved" || latestDecision === "validated") {
      status = "Validated";
    } else if (isPendingReview) {
      status = "Pending";
    } else if (rawStatus === "rejected" || latestDecision === "rejected") {
      status = "Rejected";
    } else if (!isSubmitted) {
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
      sub?.admin_remarks?.trim() ||
      undefined;

    const facultyNote = sub?.remarks?.trim() || undefined;
    const isRevision = Boolean(hasPriorRejection && status === "Pending");

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
      submittedAt: sub?.submitted_at || undefined,
      latestSubmissionId: hasActualFile ? sub?.id : undefined,
      is_read: Boolean(sub?.is_read),
      isViewed: Boolean(sub?.is_read),
      viewed_at: sub?.viewed_at || undefined,
      isRevision,
      hasPriorRevision: isRevision || hasPriorRejection,
      due_at: sub?.due_at || null,
      customDueDate,
      effectiveDeadline: effectiveDeadlineIso,
      isExtended: isExtensionActive,
      extendedUntil: extDeadlineIso,
    });
  }

  const requirementStatuses = Array.from(statusMap.values());
  const counts: StatusCountsData = {
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

    const facultyNote = row.remarks?.trim() || undefined;

    const matchedAssignment = assignmentRows.find((a) => a.id === row.faculty_assignment_id);
    let histAY = matchedAssignment?.academic_year || null;
    let histSem: "1st Semester" | "2nd Semester" | null = matchedAssignment?.term
      ? (normalizeSemester(matchedAssignment.term).includes("2") ? "2nd Semester" : "1st Semester")
      : null;

    if (!histAY || !histSem) {
      const dateTerm = toAcademicYearAndSemester(row.submitted_at || row.created_at);
      histAY = histAY || dateTerm.academicYear;
      histSem = histSem || dateTerm.semester;
    }

    pastSubmissions.push({
      id: row.id,
      academicYear: histAY,
      semester: histSem || "1st Semester",
      requirementCode: row.requirement_code,
      status: "Validated",
      submittedAt: row.submitted_at || row.created_at || new Date().toISOString(),
      updatedAt: (row as any).updated_at || undefined,
      dateValidated,
      note: facultyNote,
      remarks: facultyNote,
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

  const hasActiveGracePeriod = Boolean(personalDeadline);

  // Personalize submission window: if personal deadline exists, enforce hard overrides
  let effectiveSubmissionWindow: SubmissionWindowStateData = submissionWindow;
  if (personalDeadline) {
    effectiveSubmissionWindow = {
      isConfigured: true,
      isOpen: true,
      status: "Open",
      today: submissionWindow.today,
      currentTime: submissionWindow.currentTime,
      startDate: submissionWindow.startDate || submissionWindow.today,
      endDate: personalDeadline.endDate,
      startTime: "00:00:00",
      endTime: "23:59:59",
      academicYear: activeAcademicYear,
      semester: activeSemester,
      startTimeLabel: "12:00 AM",
      endTimeLabel: "11:59 PM",
      currentTimeLabel: submissionWindow.currentTimeLabel,
      isGracePeriod: true,
      isPersonalDeadline: true,
      effectiveDeadline: personalDeadline.effectiveDeadline,
      formattedDueAt: personalDeadline.formattedDueAt,
      badgeLabel: "Personal Deadline Active",
    };
  } else if (globalWindowLocked) {
    effectiveSubmissionWindow = {
      ...submissionWindow,
      isOpen: false,
      status: "Closed",
    };
  }

  return {
    requirementStatuses,
    requirementTemplates: activeTemplates,
    counts,
    academicYear: activeAcademicYear,
    semester: activeSemester,
    submissionWindow: effectiveSubmissionWindow,
    pastSubmissions,
    hasActiveSchedule: Boolean(hasActiveGracePeriod || (effectiveSubmissionWindow.isConfigured && effectiveSubmissionWindow.isOpen)),
    hasActiveGracePeriod,
    isLocked: !hasActiveGracePeriod && globalWindowLocked,
    department: departmentName,
    program: programInfo,
    avatarUrl,
    profileImageUrl: avatarUrl,
  };
}
