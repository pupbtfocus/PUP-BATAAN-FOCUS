import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";
type SemesterOption = "1st Semester" | "2nd Semester";

const SEMESTER_OPTIONS: SemesterOption[] = ["1st Semester", "2nd Semester"];

function buildFallbackAcademicYears(count = 5): string[] {
  const now = new Date();
  const month = now.getMonth() + 1;
  const startYear = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;

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

    const { data: appUserRow } = await supabase
      .from("app_users")
      .select("id, profile_id")
      .eq("id", facultyId)
      .maybeSingle();

    const facultyProfileId = appUserRow?.profile_id ?? facultyId;
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

    const assignmentAcademicYears = Array.from(
      new Set(
        (assignmentRows ?? [])
          .map((row: any) => row.academic_year)
          .filter(Boolean),
      ),
    ).sort((a, b) => b.localeCompare(a));

    const fallbackAcademicYears = buildFallbackAcademicYears();
    const availableAcademicYears =
      assignmentAcademicYears.length > 0
        ? assignmentAcademicYears
        : fallbackAcademicYears;

    const selectedAcademicYear =
      requestedAcademicYear &&
      availableAcademicYears.includes(requestedAcademicYear)
        ? requestedAcademicYear
        : (availableAcademicYears[0] ?? "");

    const filteredAssignmentIds = (assignmentRows ?? [])
      .filter(
        (row: any) =>
          row.academic_year === selectedAcademicYear &&
          normalizeSemester(row.term) === selectedSemester,
      )
      .map((row: any) => row.id);

    const requirementStatus = buildInitialRequirementStatus();

    if (filteredAssignmentIds.length > 0) {
      const { data: submissionRows, error: submissionsError } = await supabase
        .from("submissions")
        .select("requirement_code, status")
        .eq("faculty_profile_id", facultyProfileId)
        .in("faculty_assignment_id", filteredAssignmentIds)
        .limit(1000);

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

      for (const row of submissionRows ?? []) {
        const code =
          row.requirement_code as (typeof DEFAULT_REQUIREMENTS)[number];

        if (!DEFAULT_REQUIREMENTS.includes(code)) {
          continue;
        }

        const mappedStatus = toRequirementStatus(row.status);

        if (rank[mappedStatus] > rank[requirementStatus[code]]) {
          requirementStatus[code] = mappedStatus;
        }
      }
    }

    return NextResponse.json({
      availableAcademicYears,
      semesters: SEMESTER_OPTIONS,
      selectedAcademicYear,
      selectedSemester,
      requirementStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load requirements", details: String(error) },
      { status: 500 },
    );
  }
}
