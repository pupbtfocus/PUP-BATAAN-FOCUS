import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";
type SemesterOption = "1st Semester" | "2nd Semester";

type SubmissionRow = {
  requirement_code: string;
  status: string | null;
  submitted_at?: string | null;
  document_versions?: Array<{ id: string }> | null;
};

const SEMESTER_OPTIONS: SemesterOption[] = ["1st Semester", "2nd Semester"];

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

  return "1st Semester";
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
): Promise<{ academicYear: string; semester: SemesterOption } | null> {
  const { data: currentTerm, error } = await supabase
    .from("academic_terms")
    .select("academic_year, semester")
    .eq("status", "Current")
    .limit(1)
    .maybeSingle();

  if (error || !currentTerm?.academic_year || !currentTerm?.semester) {
    return null;
  }

  return {
    academicYear: currentTerm.academic_year,
    semester: normalizeSemester(currentTerm.semester),
  };
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
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  return Array.isArray(submission.document_versions)
    ? submission.document_versions.length > 0
    : false;
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
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const facultyId = url.searchParams.get("facultyId");
    const requestedAcademicYear = url.searchParams.get("academicYear");
    const selectedSemester = normalizeSemester(
      url.searchParams.get("semester"),
    );

    if (!facultyId) {
      return NextResponse.json(
        { error: "facultyId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Try to locate app_user row by either app_users.id or profile_id (front-end may pass profile id)
    const { data: appUserRow, error: appUserError } = await supabase
      .from("app_users")
      .select("id, profile_id")
      .or(`id.eq.${facultyId},profile_id.eq.${facultyId}`)
      .maybeSingle();

    if (appUserError || !appUserRow?.profile_id) {
      return NextResponse.json(
        {
          error: "Faculty profile not found",
          details: appUserError?.message || "No profile_id for this faculty",
        },
        { status: 404 },
      );
    }

    const facultyProfileId = appUserRow.profile_id;
    const assignmentFacultyIds = Array.from(
      new Set([facultyId, facultyProfileId].filter(Boolean)),
    );

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("faculty_program_assignments")
      .select("id, academic_year, term")
      .in("faculty_profile_id", assignmentFacultyIds)
      .limit(500);

    if (assignmentError) {
      return NextResponse.json(
        {
          error: "Failed to load faculty assignments",
          details: assignmentError.message,
        },
        { status: 500 },
      );
    }

    const currentAcademicTerm = await getCurrentAcademicTerm(supabase);

    const assignmentAcademicYears = Array.from(
      new Set(
        (assignmentRows ?? [])
          .map((row: any) => row.academic_year)
          .filter(Boolean),
      ),
    ).sort((a, b) => b.localeCompare(a));

    if (
      currentAcademicTerm &&
      !assignmentAcademicYears.includes(currentAcademicTerm.academicYear)
    ) {
      assignmentAcademicYears.unshift(currentAcademicTerm.academicYear);
    }

    const fallbackAcademicYears = buildFallbackAcademicYears();
    const availableAcademicYears =
      assignmentAcademicYears.length > 0
        ? assignmentAcademicYears
        : fallbackAcademicYears;

    const selectedAcademicYear =
      requestedAcademicYear &&
      availableAcademicYears.includes(requestedAcademicYear)
        ? requestedAcademicYear
        : (currentAcademicTerm?.academicYear ??
          availableAcademicYears[0] ??
          "");

    let availableSemesters = getAvailableSemestersForAcademicYear(
      assignmentRows ?? [],
      selectedAcademicYear,
    );

    if (
      availableSemesters.length === 0 &&
      currentAcademicTerm &&
      currentAcademicTerm.academicYear === selectedAcademicYear
    ) {
      availableSemesters = [currentAcademicTerm.semester];
    }

    const effectiveSelectedSemester =
      selectedSemester && availableSemesters.includes(selectedSemester)
        ? selectedSemester
        : (availableSemesters[0] ??
          currentAcademicTerm?.semester ??
          "1st Semester");

    const filteredAssignmentIds = (assignmentRows ?? [])
      .filter(
        (row: any) =>
          row.academic_year === selectedAcademicYear &&
          normalizeSemester(row.term) === effectiveSelectedSemester,
      )
      .map((row: any) => row.id);

    const requirementStatus = buildInitialRequirementStatus();

    let submissionRows: SubmissionRow[] | null = null;
    let submissionsError: { message?: string } | null = null;

    if (filteredAssignmentIds.length > 0) {
      const submissionQuery = supabase
        .from("submissions")
        .select("requirement_code, status, submitted_at, document_versions(id)")
        .eq("faculty_profile_id", facultyProfileId)
        .in("faculty_assignment_id", filteredAssignmentIds)
        .order("submitted_at", { ascending: false })
        .limit(1000);

      const submissionResult = await submissionQuery;
      submissionRows = submissionResult.data as SubmissionRow[] | null;
      submissionsError = submissionResult.error;
    } else {
      submissionRows = [];
    }

    if (submissionsError) {
      return NextResponse.json(
        {
          error: "Failed to load faculty requirements",
          details: submissionsError.message,
        },
        { status: 500 },
      );
    }

    const rank: Record<RequirementStatus, number> = {
      not_submitted: 0,
      uploaded: 1,
      validated: 2,
    };

    // Process submissions: get the best status for each requirement (highest rank)
    for (const row of submissionRows ?? []) {
      const code =
        row.requirement_code as (typeof DEFAULT_REQUIREMENTS)[number];

      if (!DEFAULT_REQUIREMENTS.includes(code)) {
        continue;
      }

      if (!hasDocumentVersion(row)) {
        continue;
      }

      if (requirementStatus[code] !== "not_submitted") {
        continue;
      }

      const mappedStatus = toRequirementStatus(row.status);

      if (rank[mappedStatus] > rank[requirementStatus[code]]) {
        requirementStatus[code] = mappedStatus;
      }
    }

    return NextResponse.json({
      availableAcademicYears,
      semesters: SEMESTER_OPTIONS,
      availableSemesters,
      selectedAcademicYear,
      selectedSemester: effectiveSelectedSemester,
      currentAcademicYear: currentAcademicTerm?.academicYear ?? null,
      currentSemester: currentAcademicTerm?.semester ?? null,
      currentTermConfigured: Boolean(currentAcademicTerm),
      requirementStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load requirements", details: String(error) },
      { status: 500 },
    );
  }
}
