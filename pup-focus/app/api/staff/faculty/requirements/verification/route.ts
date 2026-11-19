import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import {
  ROLE,
  isOriginalAdmin,
  isOriginalSuperAdmin,
  isQaAdmin,
  isQaStaff, resolveTrustedUserRole } from "@/config/roles";
import {
  escapeFilterValue,
  filterUuids,
  orFilter,
} from "@/lib/supabase/filters";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isTemplateHiddenForTerm,
  cleanDescription,
} from "@/lib/requirement-templates/term-visibility";

type RequirementStatus =
  | "not_submitted"
  | "uploaded"
  | "validated"
  | "rejected"
  | "needs_revision";
type SemesterOption = "1st Semester" | "2nd Semester" | "Summer Semester";

const serverVerificationCache = new Map<
  string,
  {
    timestamp: number;
    payload: any;
  }
>();
const SERVER_CACHE_TTL_MS = 15_000;

type SubmissionRow = {
  id: string;
  requirement_code: string;
  status: string | null;
  submitted_at?: string | null;
  document_versions?: Array<{ id: string }> | null;
};

const SEMESTER_OPTIONS: SemesterOption[] = [
  "1st Semester",
  "2nd Semester",
  "Summer Semester",
];

function matchRequirementCode(
  inputCode?: string | null,
  inputReqId?: string | null,
  templates: Array<{ code: string }> = [],
): string | null {
  const candidates = [inputCode, inputReqId].filter(Boolean) as string[];
  for (const raw of candidates) {
    const s = raw.toLowerCase().trim().replace(/[-_\s]+/g, "");
    for (const tpl of templates) {
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
  return inputCode ? inputCode.trim() : null;
}

function getCurrentYearInManila(): number {
  const yearText = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
  }).format(new Date());

  return Number(yearText);
}

function buildFallbackAcademicYears(count = 5): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const manilaYear = getCurrentYearInManila();
  const startYear = month >= 6 ? manilaYear : manilaYear - 1;

  return Array.from({ length: count }, (_, index) => {
    const yearStart = startYear - index;
    return `${yearStart}-${yearStart + 1}`;
  });
}

function normalizeSemester(input: string | null): SemesterOption {
  if (!input) {
    return "1st Semester";
  }

  const normalized = input.trim().toLowerCase();

  if (normalized === "2nd semester" || normalized === "second semester") {
    return "2nd Semester";
  }
  if (
    normalized === "summer semester" ||
    normalized === "summer term" ||
    normalized === "summer sem" ||
    normalized === "summer" ||
    normalized.includes("summer")
  ) {
    return "Summer Semester";
  }

  return "1st Semester";
}

function normalizeAcademicYear(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^s\.?y\.?\s*/i, "")
    .replace(/^a\.?y\.?\s*/i, "");
}

function toAcademicYearAndSemester(dateInput: string | null | undefined): {
  academicYear: string;
  semester: SemesterOption;
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

function isMissingFacultyAssignmentIdError(
  error: { message?: string } | null,
): boolean {
  const message = (error?.message || "").toLowerCase();
  return (
    message.includes("faculty_assignment_id") &&
    (message.includes("submissions") ||
      message.includes("schema cache") ||
      message.includes("does not exist") ||
      message.includes("column"))
  );
}

function getAvailableSemestersForAcademicYear(
  rows: unknown[],
  academicYear: string,
): SemesterOption[] {
  const semesters = new Set<SemesterOption>();

  for (const row of rows as any[]) {
    if (row.academic_year !== academicYear) {
      continue;
    }

    semesters.add(normalizeSemester(row.term));
  }

  return SEMESTER_OPTIONS.filter((semester) => semesters.has(semester));
}

async function getCurrentAcademicTerm(
  supabase: any,
): Promise<{ academicYear: string; semester: SemesterOption; createdAt?: string | null } | null> {
  const { data: currentTerm, error } = await supabase
    .from("academic_terms")
    .select("academic_year, semester, created_at")
    .eq("status", "Current")
    .limit(1)
    .maybeSingle();

  if (error || !currentTerm?.academic_year || !currentTerm?.semester) {
    return null;
  }

  return {
    academicYear: currentTerm.academic_year,
    semester: normalizeSemester(currentTerm.semester),
    createdAt: currentTerm.created_at || null,
  };
}

function convertManilaDateTimeToUtcIso(dateTime: string | null): string | null {
  if (!dateTime) {
    return null;
  }

  const date = new Date(`${dateTime}+08:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toRequirementStatus(rawStatus: string | null): RequirementStatus {
  const status = (rawStatus ?? "").toLowerCase().trim();

  if (status === "validated" || status === "approved") {
    return "validated";
  }

  if (status === "needs_revision") {
    return "needs_revision";
  }

  if (
    status === "rejected" ||
    status === "returned" ||
    status === "revision" ||
    status === "revision_requested"
  ) {
    return "rejected";
  }

  if (
    status === "uploaded" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "pending_review" ||
    status === "pending"
  ) {
    return "uploaded";
  }

  return "not_submitted";
}

function buildInitialRequirementStatus(): Record<
  (typeof DEFAULT_REQUIREMENTS)[number],
  RequirementStatus
> {
  return DEFAULT_REQUIREMENTS.reduce(
    (acc, code) => {
      acc[code] = "not_submitted";
      return acc;
    },
    {} as Record<(typeof DEFAULT_REQUIREMENTS)[number], RequirementStatus>,
  );
}

function hasDocumentVersion(submission: {
  id?: string;
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  if (Array.isArray(submission.document_versions)) {
    return submission.document_versions.length > 0;
  }
  return Boolean(submission.id);
}

export async function GET(request: NextRequest) {
  try {
    let user: any = null;
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user: sessionUser },
    } = await sessionClient.auth.getUser();
    user = sessionUser;

    // Fallback: check Authorization: Bearer <token>
    if (!user) {
      const authHeader =
        request.headers.get("authorization") ||
        request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.substring(7).trim();
        const adminSupabase = getServiceRoleClient();
        const { data: tokenData } = await adminSupabase.auth.getUser(token);
        user = tokenData?.user ?? null;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requesterRole =
      resolveTrustedUserRole(user);
    const normalizedRequesterRole = (requesterRole ?? "").toLowerCase().trim();

    const isAuthorized =
      normalizedRequesterRole === ROLE.STAFF ||
      normalizedRequesterRole === ROLE.ADMIN ||
      normalizedRequesterRole === ROLE.SUPER_ADMIN ||
      normalizedRequesterRole === "super_admin" ||
      normalizedRequesterRole === "superadmin" ||
      normalizedRequesterRole.includes("staff") ||
      normalizedRequesterRole.includes("admin") ||
      normalizedRequesterRole.includes("super") ||
      isOriginalAdmin(user.email) ||
      isOriginalSuperAdmin(user.email) ||
      isQaAdmin(user.email) ||
      isQaStaff(user.email);

    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const facultyId = url.searchParams.get("facultyId");
    const facultyIdsParam = url.searchParams.get("facultyIds");
    const requestedAcademicYear = url.searchParams.get("academicYear");
    const hasSemesterParam = url.searchParams.has("semester");
    const selectedSemester = normalizeSemester(
      url.searchParams.get("semester"),
    );

    const requestedIdsRaw = facultyIdsParam
      ? facultyIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : facultyId
        ? [facultyId.trim()]
        : [];

    if (requestedIdsRaw.length === 0) {
      return NextResponse.json(
        { error: "facultyId or facultyIds is required" },
        { status: 400 },
      );
    }

    // Profile and auth-user ids are UUIDs. Reject anything else so a crafted
    // value can never be parsed as PostgREST filter syntax.
    const requestedIds = filterUuids(requestedIdsRaw);
    if (requestedIds.length === 0) {
      return NextResponse.json(
        { error: "facultyId or facultyIds must be valid UUIDs" },
        { status: 400 }
      );
    }

    const cacheKey = `${user.id}:${requestedAcademicYear || ""}:${selectedSemester || ""}:${requestedIds.slice().sort().join(",")}`;
    const hasCacheBuster = url.searchParams.has("_t");
    const cached = !hasCacheBuster ? serverVerificationCache.get(cacheKey) : null;
    if (cached && Date.now() - cached.timestamp < SERVER_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const supabase = getServiceRoleClient();

    // Parallel Wave: Fetch profiles, terms, templates, assignments, classes, and submissions in a single round-trip
    const [
      profilesRes,
      dbTermsRes,
      dbTemplatesRes,
      assignmentRowsRes,
      classesRes,
      submissionsRes,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, user_id")
        .or(
          orFilter([
            `id.in.(${requestedIds.map(escapeFilterValue).join(",")})`,
            `user_id.in.(${requestedIds.map(escapeFilterValue).join(",")})`,
          ])
        ),
      supabase
        .from("academic_terms")
        .select("academic_year, semester, status, created_at")
        .order("academic_year", { ascending: false }),
      supabase
        .from("requirement_templates")
        .select("*")
        .order("is_mandatory", { ascending: false })
        .order("created_at", { ascending: true }),
      supabase
        .from("faculty_program_assignments")
        .select("id, faculty_profile_id, academic_year, term")
        .in("faculty_profile_id", requestedIds)
        .limit(2000),
      supabase
        .from("faculty_classes")
        .select("id, faculty_profile_id, subject_code, description, section_code, units, is_archived, academic_year, semester")
        .in("faculty_profile_id", requestedIds),
      supabase
        .from("submissions")
        .select("id, faculty_profile_id, requirement_code, status, submitted_at, faculty_assignment_id, class_id, is_archived")
        .in("faculty_profile_id", requestedIds)
        .order("submitted_at", { ascending: false }),
    ]);

    const profileMap = new Map<string, string>(); // requestedId -> profile.id
    const allProfileIds = new Set<string>();
    for (const row of profilesRes.data ?? []) {
      allProfileIds.add(row.id);
      if (requestedIds.includes(row.id)) profileMap.set(row.id, row.id);
      if (row.user_id && requestedIds.includes(row.user_id)) {
        profileMap.set(row.user_id, row.id);
      }
    }

    if (!facultyIdsParam && allProfileIds.size === 0) {
      return NextResponse.json(
        {
          error: "Faculty profile not found",
          details: "No profile for this faculty",
        },
        { status: 404 },
      );
    }

    // If any requestedId was an auth user_id whose profile.id was not in requestedIds, fetch its rows too
    const missingProfileIds = Array.from(allProfileIds).filter(
      (pid) => !requestedIds.includes(pid),
    );
    let assignmentRows = assignmentRowsRes.data ?? [];
    let rawAllClasses = (classesRes.data as any[] | null) ?? [];
    let rawAllSubmissions = (submissionsRes.data as any[] | null) ?? [];

    if (submissionsRes.error) {
      const fallbackSubs = await supabase
        .from("submissions")
        .select("id, faculty_profile_id, requirement_code, status, submitted_at, faculty_assignment_id, class_id")
        .in("faculty_profile_id", Array.from(new Set([...requestedIds, ...allProfileIds])))
        .order("submitted_at", { ascending: false });
      rawAllSubmissions = (fallbackSubs.data as any[] | null) ?? [];
    }

    if (classesRes.error) {
      const fallbackClasses = await supabase
        .from("faculty_classes")
        .select("id, faculty_profile_id, subject_code, description, section_code, units, academic_year, semester")
        .in("faculty_profile_id", Array.from(new Set([...requestedIds, ...allProfileIds])));
      rawAllClasses = ((fallbackClasses.data as any[] | null) ?? []).map((c) => ({
        ...c,
        is_archived: false,
      }));
    }

    if (missingProfileIds.length > 0) {
      const [extraAssignments, extraClasses, extraSubs] = await Promise.all([
        supabase
          .from("faculty_program_assignments")
          .select("id, faculty_profile_id, academic_year, term")
          .in("faculty_profile_id", missingProfileIds)
          .limit(2000),
        supabase
          .from("faculty_classes")
          .select("id, faculty_profile_id, subject_code, description, section_code, units, is_archived, academic_year, semester")
          .in("faculty_profile_id", missingProfileIds),
        supabase
          .from("submissions")
          .select("id, faculty_profile_id, requirement_code, status, submitted_at, faculty_assignment_id, class_id, is_archived")
          .in("faculty_profile_id", missingProfileIds)
          .order("submitted_at", { ascending: false }),
      ]);
      if (extraAssignments.data?.length) {
        assignmentRows = [...assignmentRows, ...extraAssignments.data];
      }
      if (extraClasses.data?.length) {
        rawAllClasses = [...rawAllClasses, ...extraClasses.data];
      }
      if (extraSubs.data?.length) {
        rawAllSubmissions = [...rawAllSubmissions, ...extraSubs.data];
      }
    }

    const archivedClassIds = new Set<string>(
      rawAllClasses
        .filter((c: any) => Boolean(c.is_archived))
        .map((c: any) => c.id)
        .filter(Boolean),
    );
    const activeClasses = rawAllClasses.filter((c: any) => !c.is_archived);
    const nonArchivedSubmissions = rawAllSubmissions.filter(
      (s: any) => !s.is_archived && !(s.class_id && archivedClassIds.has(s.class_id)),
    );
    const dbTerms = dbTermsRes.data ?? [];

    const currentTermRow = dbTerms.find(
      (t: any) => (t.status || "").trim().toLowerCase() === "current",
    );
    const currentAcademicTerm = currentTermRow?.academic_year && currentTermRow?.semester
      ? {
          academicYear: currentTermRow.academic_year,
          semester: normalizeSemester(currentTermRow.semester),
          createdAt: currentTermRow.created_at || null,
        }
      : null;

    const termsByYear: Record<string, SemesterOption[]> = {};

    const registerTerm = (ay?: string | null, sem?: string | null) => {
      if (!ay || !sem) return;
      const normalizedSem = normalizeSemester(sem);
      if (!termsByYear[ay]) {
        termsByYear[ay] = [];
      }
      if (!termsByYear[ay].includes(normalizedSem)) {
        termsByYear[ay].push(normalizedSem);
      }
    };

    (dbTerms ?? []).forEach((t: any) => registerTerm(t.academic_year, t.semester));
    (assignmentRows ?? []).forEach((row: any) => registerTerm(row.academic_year, row.term));
    if (currentAcademicTerm) {
      registerTerm(currentAcademicTerm.academicYear, currentAcademicTerm.semester);
    }
    const SEMESTER_SORT_ORDER: Record<string, number> = {
      "1st Semester": 1,
      "2nd Semester": 2,
      "Summer Semester": 3,
    };

    Object.keys(termsByYear).forEach((ay) => {
      termsByYear[ay].sort(
        (a, b) => (SEMESTER_SORT_ORDER[a] ?? 99) - (SEMESTER_SORT_ORDER[b] ?? 99),
      );
    });

    const availableAcademicYears = Object.keys(termsByYear).sort((a, b) => b.localeCompare(a));

    if (availableAcademicYears.length === 0) {
      const fallbackYears = buildFallbackAcademicYears(1);
      const defaultYear = fallbackYears[0] || "2024-2025";
      termsByYear[defaultYear] = ["1st Semester", "2nd Semester"];
      availableAcademicYears.push(defaultYear);
    }

    const selectedAcademicYear =
      requestedAcademicYear &&
      availableAcademicYears.includes(requestedAcademicYear)
        ? requestedAcademicYear
        : (currentAcademicTerm?.academicYear && availableAcademicYears.includes(currentAcademicTerm.academicYear)
          ? currentAcademicTerm.academicYear
          : availableAcademicYears[0] ?? "");

    let availableSemesters = termsByYear[selectedAcademicYear] ?? [];
    if (availableSemesters.length === 0) {
      availableSemesters = ["1st Semester", "2nd Semester"];
    }

    const effectiveSelectedSemester =
      hasSemesterParam && selectedSemester && availableSemesters.includes(selectedSemester)
        ? selectedSemester
        : (currentAcademicTerm?.semester && availableSemesters.includes(currentAcademicTerm.semester)
          ? currentAcademicTerm.semester
          : availableSemesters[0] ?? "1st Semester");

    let activeTemplateRows: Array<{
      code: string;
      title: string;
      is_mandatory: boolean;
      is_active: boolean;
      max_size_mb: number;
      allowed_formats: string[];
    }> = [];

    const filteredAssignments = (assignmentRows ?? []).filter(
      (row: any) =>
        normalizeAcademicYear(row.academic_year) ===
          normalizeAcademicYear(selectedAcademicYear) &&
        normalizeSemester(row.term) === effectiveSelectedSemester,
    );
    const allFilteredAssignmentIds = filteredAssignments.map((row: any) => row.id);

    const allSubmissionRows = nonArchivedSubmissions.filter(
      (s: any) =>
        allFilteredAssignmentIds.length === 0 ||
        !s.faculty_assignment_id ||
        allFilteredAssignmentIds.includes(s.faculty_assignment_id),
    );

    const isCurrentTerm = Boolean(
      currentAcademicTerm &&
      normalizeAcademicYear(currentAcademicTerm.academicYear) ===
        normalizeAcademicYear(selectedAcademicYear) &&
      normalizeSemester(currentAcademicTerm.semester) ===
        effectiveSelectedSemester
    );

    if (!dbTemplatesRes.error && Array.isArray(dbTemplatesRes.data)) {
      const submittedCodesInTerm = new Set(
        allSubmissionRows
          .map((s: any) => matchRequirementCode(s.requirement_code, s.requirement_id, dbTemplatesRes.data) || s.requirement_code)
          .filter(Boolean)
      );

      const seenTemplateCodes = new Set<string>();
      activeTemplateRows = dbTemplatesRes.data
        .filter((t: any) => {
          const codeKey = (t.code || "").trim().toLowerCase();
          if (!codeKey || seenTemplateCodes.has(codeKey)) {
            return false;
          }

          // If evaluating current active term, only strictly active templates apply
          if (isCurrentTerm) {
            if (!t.is_active) return false;
            seenTemplateCodes.add(codeKey);
            return true;
          }

          // Evaluating past/other term:
          // 1. If faculty made submissions for this requirement in this term, keep it visible
          if (submittedCodesInTerm.has(t.code)) {
            seenTemplateCodes.add(codeKey);
            return true;
          }

          // 2. If explicitly hidden for this term or currently hidden, do not show it
          if (
            !t.is_active ||
            isTemplateHiddenForTerm(t, selectedAcademicYear, effectiveSelectedSemester, false)
          ) {
            return false;
          }

          // 3. Otherwise keep active standard requirements visible
          if ((DEFAULT_REQUIREMENTS as readonly string[]).includes(t.code)) {
            seenTemplateCodes.add(codeKey);
            return true;
          }

          return false;
        })
        .map((t: any) => ({
          code: t.code,
          title: t.title,
          is_mandatory: Boolean(t.is_mandatory),
          is_active: Boolean(t.is_active),
          max_size_mb: t.max_size_mb || 5,
          allowed_formats: t.allowed_formats || ["PDF"],
        }));
    }

    const CANONICAL_ORDER: Record<string, number> = {
      [REQUIREMENT_CODE.GRADE_SHEET]: 1,
      [REQUIREMENT_CODE.ENHANCED_SYLLABUS]: 2,
      [REQUIREMENT_CODE.CLASS_ORIENTATION]: 3,
      [REQUIREMENT_CODE.MIDTERM_PACKAGE]: 4,
      [REQUIREMENT_CODE.FINAL_PACKAGE]: 5,
      [REQUIREMENT_CODE.CLASS_RECORDS]: 6,
    };
    activeTemplateRows.sort((a, b) => {
      const orderA = CANONICAL_ORDER[a.code] ?? 100;
      const orderB = CANONICAL_ORDER[b.code] ?? 100;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
    const allFacultyClasses = activeClasses;

    const rank: Record<RequirementStatus, number> = {
      not_submitted: 0,
      uploaded: 1,
      validated: 2,
      needs_revision: 3,
      rejected: 3,
    };

    const activeTemplateCodeSet = new Set(activeTemplateRows.map((t) => t.code));
    const mandatoryTemplates = activeTemplateRows.filter((t) => t.is_mandatory);
    const reqsToCheck = mandatoryTemplates.length > 0 ? mandatoryTemplates : activeTemplateRows;

    const computeForFaculty = (reqFacultyId: string) => {
      const resolvedProfileId = profileMap.get(reqFacultyId) || reqFacultyId;
      const validIds = new Set([reqFacultyId, resolvedProfileId]);

      const requirementStatus: Record<string, RequirementStatus> = {};
      for (const tpl of activeTemplateRows) {
        requirementStatus[tpl.code] = "not_submitted";
      }

      const rawClasses = allFacultyClasses.filter((fc: any) =>
        validIds.has(fc.faculty_profile_id),
      );
      let facultyClassesData = rawClasses.filter((fc: any) => {
        if (fc.academic_year && selectedAcademicYear) {
          if (normalizeAcademicYear(fc.academic_year) !== normalizeAcademicYear(selectedAcademicYear)) {
            return false;
          }
        }
        if (fc.semester && effectiveSelectedSemester) {
          if (normalizeSemester(fc.semester) !== normalizeSemester(effectiveSelectedSemester)) {
            return false;
          }
        }
        return true;
      });
      if (facultyClassesData.length === 0 && rawClasses.length > 0) {
        facultyClassesData = rawClasses;
      }
      const facultyClassIdSet = new Set<string>(
        facultyClassesData.map((c: any) => c.id).filter(Boolean),
      );
      const otherTermClassIdSet = new Set<string>(
        rawClasses
          .filter((c: any) => c.id && !facultyClassIdSet.has(c.id))
          .map((c: any) => c.id),
      );

      const facultyAssignmentIds = new Set(
        filteredAssignments
          .filter((a: any) => validIds.has(a.faculty_profile_id))
          .map((a: any) => a.id),
      );
      const facultyAllAssignmentIds = new Set(
        (assignmentRows ?? [])
          .filter((a: any) => validIds.has(a.faculty_profile_id))
          .map((a: any) => a.id),
      );

      const facultySubmissions = allSubmissionRows.filter((s: any) => {
        if (!validIds.has(s.faculty_profile_id)) return false;
        if (s.class_id && otherTermClassIdSet.has(s.class_id)) return false;
        if (s.faculty_assignment_id) {
          if (facultyAssignmentIds.size > 0) {
            return facultyAssignmentIds.has(s.faculty_assignment_id);
          }
          // Keep if not bound to another term's assignment
          return !facultyAllAssignmentIds.has(s.faculty_assignment_id);
        }
        // Include uploads whose faculty_assignment_id is null (e.g. rows created after a reset)
        if (!s.submitted_at) return false;
        return isCurrentTerm || (Boolean(s.class_id) && facultyClassIdSet.has(s.class_id));
      });

      const seenSlotKeys = new Set<string>();
      for (const row of facultySubmissions) {
        const code = matchRequirementCode(
          row.requirement_code,
          (row as { requirement_id?: string }).requirement_id,
          activeTemplateRows,
        );
        if (!code || !activeTemplateCodeSet.has(code) || !hasDocumentVersion(row)) continue;
        const slotKey = `${code}:${(row as { class_id?: string | null }).class_id ?? "__global__"}`;
        if (seenSlotKeys.has(slotKey)) continue;
        seenSlotKeys.add(slotKey);
        const mappedStatus = toRequirementStatus(row.status);
        if (rank[mappedStatus] > rank[requirementStatus[code] ?? "not_submitted"]) {
          requirementStatus[code] = mappedStatus;
        }
      }

      const classProgressList = facultyClassesData.map((cls: any, clsIdx: number) => {
        const classSubs = facultySubmissions.filter(
          (s: any) =>
            s.class_id === cls.id ||
            (!s.class_id && (facultyClassesData.length === 1 || clsIdx === 0)),
        );
        const latestStatusByCode = new Map<string, RequirementStatus>();
        for (const s of classSubs) {
          const code = matchRequirementCode(
            s.requirement_code,
            (s as any).requirement_id,
            activeTemplateRows,
          );
          if (!code || !activeTemplateCodeSet.has(code) || !hasDocumentVersion(s)) continue;
          if (!latestStatusByCode.has(code)) {
            latestStatusByCode.set(code, toRequirementStatus(s.status));
          }
        }
        const validatedCount = reqsToCheck.filter(
          (t) => latestStatusByCode.get(t.code) === "validated",
        ).length;
        const hasRevision = reqsToCheck.some((t) => {
          const st = latestStatusByCode.get(t.code);
          return st === "rejected" || st === "needs_revision";
        });
        const totalRequired = reqsToCheck.length;
        const isDone = totalRequired > 0 && validatedCount >= totalRequired && !hasRevision;

        return {
          id: cls.id,
          subject_code: cls.subject_code,
          section_code: cls.section_code,
          description: cls.description,
          units: cls.units,
          totalRequired,
          validatedCount,
          isDone,
        };
      });

      const totalSubjects = classProgressList.length;
      const doneSubjects = classProgressList.filter((c: any) => c.isDone).length;

      return {
        requirementStatus,
        classProgress: classProgressList,
        subjectProgress: {
          totalSubjects,
          doneSubjects,
          allDone: totalSubjects > 0 && doneSubjects === totalSubjects,
        },
      };
    };

    if (facultyIdsParam) {
      const resultsByFacultyId: Record<string, ReturnType<typeof computeForFaculty>> = {};
      for (const id of requestedIds) {
        resultsByFacultyId[id] = computeForFaculty(id);
      }

      const payload = {
        availableAcademicYears,
        semesters: SEMESTER_OPTIONS,
        availableSemesters,
        termsByYear,
        selectedAcademicYear,
        selectedSemester: effectiveSelectedSemester,
        currentAcademicYear: currentAcademicTerm?.academicYear ?? null,
        currentSemester: currentAcademicTerm?.semester ?? null,
        currentTermConfigured: Boolean(currentAcademicTerm),
        requirementTemplates: activeTemplateRows,
        resultsByFacultyId,
      };

      serverVerificationCache.set(cacheKey, {
        timestamp: Date.now(),
        payload,
      });

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const singleResult = computeForFaculty(requestedIds[0]);
    const payload = {
      availableAcademicYears,
      semesters: SEMESTER_OPTIONS,
      availableSemesters,
      termsByYear,
      selectedAcademicYear,
      selectedSemester: effectiveSelectedSemester,
      currentAcademicYear: currentAcademicTerm?.academicYear ?? null,
      currentSemester: currentAcademicTerm?.semester ?? null,
      currentTermConfigured: Boolean(currentAcademicTerm),
      requirementStatus: singleResult.requirementStatus,
      requirementTemplates: activeTemplateRows,
      classProgress: singleResult.classProgress,
      subjectProgress: singleResult.subjectProgress,
    };

    serverVerificationCache.set(cacheKey, {
      timestamp: Date.now(),
      payload,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error(
      "Unhandled error in /api/admin/faculty/requirements/verification:",
      error,
    );
    return NextResponse.json(
      { error: "Failed to load requirements", details: String(error) },
      { status: 500 },
    );
  }
}
