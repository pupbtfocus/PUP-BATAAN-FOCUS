import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isValidAcademicYear,
  isValidSemester,
  normalizeSemester,
} from "@/features/submissions/services/submission-window.service";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

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
  return role === ROLE.STAFF || role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN || role === "staff";
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
    let { data: termRows, error: termError } = await supabase
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

    // Ensure all existing academic years have Summer Semester
    if (Array.isArray(termRows) && termRows.length > 0) {
      const currentTerms = termRows;
      const distinctYears = Array.from(
        new Set(currentTerms.map((r) => r.academic_year)),
      );
      const missingSummerYears = distinctYears.filter((year) => {
        const termsForYear = currentTerms.filter((r) => r.academic_year === year);
        const hasSummer = termsForYear.some((r) =>
          (r.semester || "").toLowerCase().includes("summer"),
        );
        return !hasSummer;
      });

      if (missingSummerYears.length > 0) {
        const rowsToInsert = missingSummerYears.map((year) => {
          const termsForYear = currentTerms.filter((r) => r.academic_year === year);
          const allArchived = termsForYear.every(
            (r) =>
              r.status === "Archived" || (r.status as string) === "Completed",
          );
          return {
            academic_year: year,
            semester: "Summer Semester",
            status: (allArchived ? "Archived" : "Upcoming") as AcademicTermStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        const { error: insertMissingError } = await supabase
          .from("academic_terms")
          .insert(rowsToInsert);

        if (!insertMissingError) {
          const { data: refreshedRows } = await supabase
            .from("academic_terms")
            .select("academic_year, semester, status")
            .order("academic_year", { ascending: false })
            .order("semester", { ascending: true });
          if (refreshedRows) {
            termRows = refreshedRows;
          }
        }
      }
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
      let { data: submissionRows, error: submissionError } = await supabase
        .from("submissions")
        .select("faculty_assignment_id")
        .in("faculty_assignment_id", assignmentIds);

      if (
        submissionError &&
        isMissingFacultyAssignmentIdError(submissionError)
      ) {
        submissionRows = [];
        submissionError = null;
      }

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

export async function POST(request: NextRequest) {
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

    let body: any = null;
    try {
      body = await request.json();
    } catch {
      // No JSON body
    }

    if (body?.action === "add_summer" && body?.academicYear) {
      const targetAy = String(body.academicYear).trim();
      const { data: existingSummer } = await supabase
        .from("academic_terms")
        .select("semester")
        .eq("academic_year", targetAy)
        .ilike("semester", "%summer%")
        .maybeSingle();

      if (existingSummer) {
        return NextResponse.json(
          { error: "Summer Semester already exists for this academic year." },
          { status: 409 },
        );
      }

      const { error: insertErr } = await supabase
        .from("academic_terms")
        .insert({
          academic_year: targetAy,
          semester: "Summer Semester",
          status: "Upcoming",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertErr) {
        return NextResponse.json(
          {
            error: "Failed to add Summer Semester",
            details: insertErr.message,
          },
          { status: 500 },
        );
      }

      void logTransactionEvent({
        actorId: user.id,
        action: "academic_term.summer_create",
        entityType: "academic_term",
        entityId: user.id,
        metadata: { academic_year: targetAy, semester: "Summer Semester" },
      });

      return NextResponse.json({ success: true, added: true });
    }
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
      {
        academic_year: nextAcademicYear,
        semester: "Summer Semester",
        status: "Upcoming" as AcademicTermStatus,
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

    void logTransactionEvent({
      actorId: user.id,
      action: "academic_term.create",
      entityType: "academic_term",
      entityId: user.id,
      metadata: { academic_year: nextAcademicYear },
    });

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

function getTermScore(academicYear: string, semester: string): number {
  const startYear = parseInt(academicYear.split("-")[0], 10) || 0;
  const semNorm = (semester || "").toLowerCase();
  let semValue = 1;
  if (semNorm.includes("2nd") || semNorm.includes("second")) semValue = 2;
  else if (semNorm.includes("3rd") || semNorm.includes("third") || semNorm.includes("summer")) semValue = 3;
  return startYear * 10 + semValue;
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
    const { data: allTermRows, error: termError } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status");

    if (termError) {
      return NextResponse.json(
        {
          error: "Failed to fetch academic terms",
          details: termError.message,
        },
        { status: 500 },
      );
    }

    const allTerms = Array.isArray(allTermRows) ? allTermRows : [];
    const targetTerm = allTerms.find(
      (t) =>
        t.academic_year === academicYear &&
        normalizeSemester(t.semester) === semester,
    );

    if (!targetTerm) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 },
      );
    }

    // Guard 1: Term is already Archived or Completed
    if (
      targetTerm.status === "Archived" ||
      (targetTerm.status as string) === "Completed"
    ) {
      return NextResponse.json(
        { error: "Cannot reactivate a completed or past academic term." },
        { status: 400 },
      );
    }

  const currentTerm = allTerms.find((t) => t.status === "Current");

    if (currentTerm && (currentTerm.academic_year !== academicYear || normalizeSemester(currentTerm.semester) !== semester)) {
      // Guard: Strictly prevent changing the active term if no backup exists specifically for this semester
      const targetAy = currentTerm.academic_year.trim().toLowerCase();
      const targetSem = normalizeSemester(currentTerm.semester).toLowerCase();

      const { data: backupRows } = await supabase
        .from("system_backups")
        .select("id, backup_name, academic_year, metadata, status")
        .eq("status", "completed");

      const hasSemesterBackup = (backupRows ?? []).some((b: any) => {
        if (!b) return false;
        if (b.status && b.status !== "completed") return false;

        const meta = b.metadata ?? {};
        const metaScope =
          typeof meta.scope === "object" && meta.scope !== null ? meta.scope : {};

        // 1. Resolve Academic Year for this backup
        const rawAy = b.academic_year || meta.academic_year || metaScope.academic_year;
        if (!rawAy || typeof rawAy !== "string" || rawAy.trim().toLowerCase() === "all") {
          return false;
        }
        if (rawAy.trim().toLowerCase() !== targetAy) {
          return false;
        }

        // 2. Resolve Semester for this backup - must strictly match this semester (not 'all' or empty)
        const rawSem = meta.semester || metaScope.semester;
        if (rawSem && typeof rawSem === "string" && rawSem.trim().toLowerCase() !== "all") {
          const normBSem = normalizeSemester(rawSem).toLowerCase();
          if (normBSem === targetSem) {
            return true;
          }
        }

        // 3. Check backup_name if explicitly tagged with this specific AY and Semester
        const name = (b.backup_name || "").toLowerCase();
        const safeAY = targetAy.replace(/[^a-zA-Z0-9]/g, "_");
        const safeSem = targetSem.replace(/[^a-zA-Z0-9]/g, "_");

        if (name.includes(safeAY) && name.includes(safeSem)) {
          return true;
        }

        if (name.includes(safeAY)) {
          if (targetSem.includes("1st") && (name.includes("1st_sem") || name.includes("first_sem"))) {
            return true;
          }
          if (targetSem.includes("2nd") && (name.includes("2nd_sem") || name.includes("second_sem"))) {
            return true;
          }
          if (targetSem.includes("summer") && name.includes("summer")) {
            return true;
          }
        }

        return false;
      });

      if (!hasSemesterBackup) {
        return NextResponse.json(
          {
            error: "Semester Backup Required",
            details: `A backup of S.Y. ${currentTerm.academic_year} (${currentTerm.semester}) must be created in Backup & Archive before you can change to a new academic term. Backups are required per semester.`,
            missingBackup: true,
            academicYear: currentTerm.academic_year,
            semester: currentTerm.semester,
          },
          { status: 400 },
        );
      }
    }
    const targetScore = getTermScore(academicYear, semester);

    if (currentTerm) {
      const currentScore = getTermScore(
        currentTerm.academic_year,
        currentTerm.semester,
      );

      // Guard 2: Precedes the currently active term
      if (targetScore < currentScore) {
        return NextResponse.json(
          { error: "Cannot reactivate a completed or past academic term." },
          { status: 400 },
        );
      }

      // Guard 3: Must be activated sequentially (immediate next term)
      if (targetScore > currentScore) {
        const upcomingTerms = allTerms
          .filter(
            (t) =>
              t.status !== "Archived" &&
              (t.status as string) !== "Completed" &&
              getTermScore(t.academic_year, t.semester) > currentScore,
          )
          .sort(
            (a, b) =>
              getTermScore(a.academic_year, a.semester) -
              getTermScore(b.academic_year, b.semester),
          );

        if (
          upcomingTerms.length > 0 &&
          (upcomingTerms[0].academic_year !== academicYear ||
            normalizeSemester(upcomingTerms[0].semester) !== semester)
        ) {
          return NextResponse.json(
            { error: "Academic terms must be activated in sequential order." },
            { status: 400 },
          );
        }
      }
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

    // Synchronize submission window strictly for this newly activated term:
    // Every submission schedule must belong to a specific Academic Term.
    const { data: termSchedule } = await supabase
      .from("submission_window_terms")
      .select("start_date, end_date, start_time, end_time")
      .eq("academic_year", academicYear)
      .eq("semester", semester)
      .maybeSingle();

    if (termSchedule?.start_date && termSchedule?.end_date) {
      await supabase
        .from("submission_windows")
        .upsert(
          {
            id: 1,
            start_date: termSchedule.start_date,
            end_date: termSchedule.end_date,
            start_time: termSchedule.start_time || "09:00:00",
            end_time: termSchedule.end_time || "17:00:00",
            academic_year: academicYear,
            semester,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );
    } else {
      // If no schedule exists yet for the new active term, clear previous term's schedule
      await supabase.from("submission_windows").delete().eq("id", 1);
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "academic_term.set_current",
      entityType: "academic_term",
      entityId: user.id,
      metadata: { academic_year: academicYear, semester },
    });

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

    void logTransactionEvent({
      actorId: user.id,
      action: "academic_term.delete",
      entityType: "academic_term",
      entityId: user.id,
      metadata: { academic_year: academicYear, semester },
    });

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
