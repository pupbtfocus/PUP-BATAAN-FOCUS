import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isValidAcademicYear,
  isValidSemester,
  normalizeSemester,
} from "@/features/submissions/services/submission-window.service";

type AcademicTermStatus = "Current" | "Upcoming" | "Archived";

type AcademicTermRow = {
  academic_year: string;
  semester: string;
  status: AcademicTermStatus;
};

type AcademicTermResponseItem = {
  academicYear: string;
  semester: string;
  status: AcademicTermStatus;
  canDelete: boolean;
  deleteReason?: string;
};

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

function isValidAcademicTermStatus(value: string): value is AcademicTermStatus {
  return ["Current", "Upcoming", "Archived"].includes(value);
}

function buildNextAcademicYear(latestAcademicYear?: string): string {
  if (!latestAcademicYear || !isValidAcademicYear(latestAcademicYear)) {
    return "2026-2027";
  }

  const startYear = Number(latestAcademicYear.split("-")[0]);
  return `${startYear + 1}-${startYear + 2}`;
}

function buildTermKey(academicYear: string, semester: string) {
  return `${academicYear}|${semester}`;
}

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const { data: termRows, error: termError } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .order("academic_year", { ascending: false })
      .order("semester", { ascending: true });

    if (termError) {
      return NextResponse.json(
        {
          error: "Failed to load academic terms",
          details: termError.message,
        },
        { status: 500 },
      );
    }

    const latestAcademicYear =
      Array.isArray(termRows) && termRows.length > 0
        ? termRows[0].academic_year
        : undefined;
    const nextAcademicYear = buildNextAcademicYear(latestAcademicYear);

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("faculty_program_assignments")
      .select("id, academic_year, term");

    if (assignmentError) {
      return NextResponse.json(
        {
          error: "Failed to load academic term dependencies",
          details: assignmentError.message,
        },
        { status: 500 },
      );
    }

    const assignmentMap = new Map<string, string[]>();
    const assignmentIds: string[] = [];

    if (Array.isArray(assignmentRows)) {
      for (const row of assignmentRows as any[]) {
        const key = buildTermKey(
          row.academic_year,
          normalizeSemester(row.term),
        );
        const assignments = assignmentMap.get(key) ?? [];
        assignments.push(row.id);
        assignmentMap.set(key, assignments);
        assignmentIds.push(row.id);
      }
    }

    const submissionMap = new Map<string, number>();
    if (assignmentIds.length > 0) {
      const { data: submissionRows, error: submissionError } = await supabase
        .from("submissions")
        .select("faculty_assignment_id")
        .in("faculty_assignment_id", assignmentIds);

      if (submissionError) {
        return NextResponse.json(
          {
            error: "Failed to load academic term submissions",
            details: submissionError.message,
          },
          { status: 500 },
        );
      }

      for (const submission of submissionRows as any[]) {
        const assignmentId = submission.faculty_assignment_id as string;
        if (!assignmentId) {
          continue;
        }

        const matchedEntry = Array.from(assignmentMap.entries()).find(
          ([, ids]) => ids.includes(assignmentId),
        );

        if (!matchedEntry) {
          continue;
        }

        const [key] = matchedEntry;
        submissionMap.set(key, (submissionMap.get(key) ?? 0) + 1);
      }
    }

    const terms: AcademicTermResponseItem[] =
      Array.isArray(termRows) && termRows.length > 0
        ? termRows.map((term) => {
            const normalizedSemester = normalizeSemester(term.semester);
            const key = buildTermKey(term.academic_year, normalizedSemester);
            const hasAssignments = assignmentMap.has(key);
            const hasSubmissions = submissionMap.has(key);
            const canDelete = !hasAssignments && !hasSubmissions;

            return {
              academicYear: term.academic_year,
              semester: normalizedSemester,
              status: isValidAcademicTermStatus(term.status)
                ? term.status
                : "Upcoming",
              canDelete,
              deleteReason: canDelete
                ? undefined
                : "This academic term cannot be deleted because it already contains system records.",
            };
          })
        : [];

    return NextResponse.json({ terms, nextAcademicYear });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load academic terms",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = getServiceRoleClient();
    const { data: existingTerms, error: existingError } = await supabase
      .from("academic_terms")
      .select("academic_year, status")
      .order("academic_year", { ascending: false })
      .limit(1);

    if (existingError) {
      return NextResponse.json(
        {
          error: "Failed to compute next academic year",
          details: existingError.message,
        },
        { status: 500 },
      );
    }

    const latestAcademicYear =
      Array.isArray(existingTerms) && existingTerms.length > 0
        ? existingTerms[0].academic_year
        : undefined;
    const nextAcademicYear = buildNextAcademicYear(latestAcademicYear);

    const { data: duplicateTerms, error: duplicateError } = await supabase
      .from("academic_terms")
      .select("academic_year")
      .eq("academic_year", nextAcademicYear)
      .limit(1);

    if (duplicateError) {
      return NextResponse.json(
        {
          error: "Failed to validate academic year creation",
          details: duplicateError.message,
        },
        { status: 500 },
      );
    }

    if (Array.isArray(duplicateTerms) && duplicateTerms.length > 0) {
      return NextResponse.json(
        {
          error: "Academic year already exists",
          details: "A term already exists for the next academic year.",
        },
        { status: 409 },
      );
    }

    const { data: currentTerms, error: currentError } = await supabase
      .from("academic_terms")
      .select("status")
      .eq("status", "Current")
      .limit(1);

    if (currentError) {
      return NextResponse.json(
        {
          error: "Failed to validate current academic term",
          details: currentError.message,
        },
        { status: 500 },
      );
    }

    const hasCurrent = Array.isArray(currentTerms) && currentTerms.length > 0;
    const firstStatus: AcademicTermStatus = hasCurrent ? "Upcoming" : "Current";
    const secondStatus: AcademicTermStatus = "Upcoming";

    const insertRows = [
      {
        academic_year: nextAcademicYear,
        semester: "1st Semester",
        status: firstStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        academic_year: nextAcademicYear,
        semester: "2nd Semester",
        status: secondStatus,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const { error: insertError } = await supabase
      .from("academic_terms")
      .insert(insertRows);

    if (insertError) {
      return NextResponse.json(
        {
          error: "Failed to create academic year",
          details: insertError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ nextAcademicYear, created: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create academic year",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const academicYear = url.searchParams.get("academicYear")?.trim() ?? "";
    const semester = normalizeSemester(url.searchParams.get("semester"));

    if (!isValidAcademicYear(academicYear) || !isValidSemester(semester)) {
      return NextResponse.json(
        { error: "Invalid academic year or semester." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const { data: termRow, error: termError } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .match({ academic_year: academicYear, semester })
      .maybeSingle();

    if (termError) {
      return NextResponse.json(
        {
          error: "Failed to fetch academic term",
          details: termError.message,
        },
        { status: 500 },
      );
    }

    if (!termRow) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 },
      );
    }

    const { error: archiveError } = await supabase
      .from("academic_terms")
      .update({ status: "Archived", updated_at: new Date().toISOString() })
      .eq("status", "Current");

    if (archiveError) {
      return NextResponse.json(
        {
          error: "Failed to archive existing current term",
          details: archiveError.message,
        },
        { status: 500 },
      );
    }

    const { error: updateError } = await supabase
      .from("academic_terms")
      .update({ status: "Current", updated_at: new Date().toISOString() })
      .match({ academic_year: academicYear, semester });

    if (updateError) {
      return NextResponse.json(
        {
          error: "Failed to set current academic term",
          details: updateError.message,
        },
        { status: 500 },
      );
    }

    await supabase
      .from("submission_windows")
      .update({ academic_year: academicYear, semester })
      .eq("id", 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to set current academic term",
        details: String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const academicYear = url.searchParams.get("academicYear")?.trim() ?? "";
    const semester = normalizeSemester(url.searchParams.get("semester"));

    if (!isValidAcademicYear(academicYear) || !isValidSemester(semester)) {
      return NextResponse.json(
        { error: "Invalid academic year or semester." },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("faculty_program_assignments")
      .select("id")
      .match({ academic_year: academicYear, term: semester });

    if (assignmentError) {
      return NextResponse.json(
        {
          error: "Failed to validate academic term dependencies",
          details: assignmentError.message,
        },
        { status: 500 },
      );
    }

    if (Array.isArray(assignmentRows) && assignmentRows.length > 0) {
      return NextResponse.json(
        {
          error:
            "This academic term cannot be deleted because it already contains system records.",
        },
        { status: 400 },
      );
    }

    const { data: deleteResult, error: deleteError } = await supabase
      .from("academic_terms")
      .delete()
      .match({ academic_year: academicYear, semester });

    if (deleteError) {
      return NextResponse.json(
        {
          error: "Failed to delete academic term",
          details: deleteError.message,
        },
        { status: 500 },
      );
    }

    await supabase
      .from("submission_windows")
      .update({ academic_year: null, semester: null })
      .eq("id", 1)
      .eq("academic_year", academicYear)
      .eq("semester", semester);

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete academic term",
        details: String(error),
      },
      { status: 500 },
    );
  }
}
