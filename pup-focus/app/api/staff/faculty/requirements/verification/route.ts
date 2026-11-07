import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_REQUIREMENTS,
  REQUIREMENT_CODE,
  REQUIREMENT_LABEL,
  type RequirementCode,
} from "@/config/compliance";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evaluateSubmissionWindow,
  getSubmissionWindow,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";
type SemesterOption = "1st Semester" | "2nd Semester" | "Summer Semester";

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
  const status = (rawStatus ?? "").toLowerCase();

  if (status === "validated" || status === "approved") {
    return "validated";
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
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.STAFF && requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== "staff")
    ) {
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

    const requestedIds = facultyIdsParam
      ? facultyIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : facultyId
        ? [facultyId.trim()]
        : [];

    if (requestedIds.length === 0) {
      return NextResponse.json(
        { error: "facultyId or facultyIds is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Wave 1: Fetch profiles, current term, all academic terms, submission window, and templates in parallel
    const [
      profilesByIdRes,
      profilesByUserIdRes,
      currentAcademicTerm,
      dbTermsRes,
      submissionWindow,
      dbTemplatesRes,
    ] = await Promise.all([
      supabase.from("profiles").select("id, user_id").in("id", requestedIds),
      supabase.from("profiles").select("id, user_id").in("user_id", requestedIds),
      getCurrentAcademicTerm(supabase),
      supabase
        .from("academic_terms")
        .select("academic_year, semester, status")
        .order("academic_year", { ascending: false }),
      getSubmissionWindow(supabase),
      supabase
        .from("requirement_templates")
        .select("code, title, is_mandatory, max_size_mb, allowed_formats, is_active")
        .eq("is_active", true)
        .order("is_mandatory", { ascending: false })
        .order("created_at", { ascending: true }),
    ]);

    const profileMap = new Map<string, string>(); // requestedId -> profile.id
    const allProfileIds = new Set<string>();
    for (const row of [
      ...(profilesByIdRes.data ?? []),
      ...(profilesByUserIdRes.data ?? []),
    ]) {
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

    const assignmentLookupIds = Array.from(
      new Set([...requestedIds, ...Array.from(allProfileIds)]),
    );

    const { data: assignmentRows, error: assignmentError } =
      assignmentLookupIds.length > 0
        ? await supabase
            .from("faculty_program_assignments")
            .select("id, faculty_profile_id, academic_year, term")
            .in("faculty_profile_id", assignmentLookupIds)
            .limit(2000)
        : { data: [], error: null };

    if (assignmentError) {
      return NextResponse.json(
        {
          error: "Failed to load faculty assignments",
          details: assignmentError.message,
        },
        { status: 500 },
      );
    }

    const dbTerms = dbTermsRes.data;
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
      max_size_mb: number;
      allowed_formats: string[];
    }> = DEFAULT_REQUIREMENTS.map((code) => ({
      code,
      title: (REQUIREMENT_LABEL as Record<string, string>)[code] || code,
      is_mandatory: true,
      max_size_mb: 10,
      allowed_formats: ["PDF", "DOCX", "XLSX"],
    }));

    if (dbTemplatesRes.data && dbTemplatesRes.data.length > 0) {
      activeTemplateRows = dbTemplatesRes.data.map((t: any) => ({
        code: t.code,
        title: t.title,
        is_mandatory: t.is_mandatory,
        max_size_mb: t.max_size_mb || 5,
        allowed_formats: t.allowed_formats || ["PDF"],
      }));
    }

    const filteredAssignments = (assignmentRows ?? []).filter(
      (row: any) =>
        row.academic_year === selectedAcademicYear &&
        normalizeSemester(row.term) === effectiveSelectedSemester,
    );
    const allFilteredAssignmentIds = filteredAssignments.map((row: any) => row.id);

    // Wave 2: Batch fetch submissions and faculty_classes for all requested profiles in parallel
    const [submissionsRes, classesRes] = await Promise.all([
      allFilteredAssignmentIds.length > 0 && assignmentLookupIds.length > 0
        ? supabase
            .from("submissions")
            .select(
              "id, faculty_profile_id, requirement_code, status, submitted_at, faculty_assignment_id, class_id",
            )
            .in("faculty_profile_id", assignmentLookupIds)
            .in("faculty_assignment_id", allFilteredAssignmentIds)
            .order("submitted_at", { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      assignmentLookupIds.length > 0
        ? supabase
            .from("faculty_classes")
            .select("id, faculty_profile_id, subject_code, description, section_code, units, is_archived, academic_year, semester")
            .in("faculty_profile_id", assignmentLookupIds)
            .eq("is_archived", false)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (submissionsRes.error) {
      return NextResponse.json(
        {
          error: "Failed to load faculty requirements",
          details: submissionsRes.error.message,
        },
        { status: 500 },
      );
    }

    const allSubmissionRows = (submissionsRes.data as any[] | null) ?? [];
    const allFacultyClasses = (classesRes.data as any[] | null) ?? [];

    const rank: Record<RequirementStatus, number> = {
      not_submitted: 0,
      uploaded: 1,
      validated: 2,
    };

    const mandatoryTemplates = activeTemplateRows.filter((t) => t.is_mandatory);
    const reqsToCheck = mandatoryTemplates.length > 0 ? mandatoryTemplates : activeTemplateRows;

    const computeForFaculty = (reqFacultyId: string) => {
      const resolvedProfileId = profileMap.get(reqFacultyId) || reqFacultyId;
      const validIds = new Set([reqFacultyId, resolvedProfileId]);

      const requirementStatus: Record<string, RequirementStatus> = {};
      for (const tpl of activeTemplateRows) {
        requirementStatus[tpl.code] = "not_submitted";
      }
      for (const code of DEFAULT_REQUIREMENTS) {
        if (!requirementStatus[code]) {
          requirementStatus[code] = "not_submitted";
        }
      }

      const facultyAssignmentIds = new Set(
        filteredAssignments
          .filter((a: any) => validIds.has(a.faculty_profile_id))
          .map((a: any) => a.id),
      );

      const facultySubmissions = allSubmissionRows.filter(
        (s: any) =>
          validIds.has(s.faculty_profile_id) &&
          facultyAssignmentIds.has(s.faculty_assignment_id),
      );

      for (const row of facultySubmissions) {
        const code = matchRequirementCode(
          row.requirement_code,
          (row as { requirement_id?: string }).requirement_id,
          activeTemplateRows,
        );
        if (!code || !hasDocumentVersion(row)) continue;
        const mappedStatus = toRequirementStatus(row.status);
        if (!requirementStatus[code] || rank[mappedStatus] > rank[requirementStatus[code]]) {
          requirementStatus[code] = mappedStatus;
        }
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

      const classProgressList = facultyClassesData.map((cls: any) => {
        const classSubs = facultySubmissions.filter((s: any) => s.class_id === cls.id);
        const validatedReqs = new Set<string>();
        for (const s of classSubs) {
          if (toRequirementStatus(s.status) === "validated") {
            const code = matchRequirementCode(
              s.requirement_code,
              (s as any).requirement_id,
              activeTemplateRows,
            );
            if (code) validatedReqs.add(code);
          }
        }
        const validatedCount = reqsToCheck.filter((t) => validatedReqs.has(t.code)).length;
        const totalRequired = reqsToCheck.length;
        const isDone = totalRequired > 0 && validatedCount >= totalRequired;

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

      return NextResponse.json({
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
      });
    }

    const singleResult = computeForFaculty(requestedIds[0]);

    return NextResponse.json({
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
