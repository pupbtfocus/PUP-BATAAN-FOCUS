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
      // Guard: Check if current term has unvalidated or incomplete submissions
      const { data: assignments } = await supabase
        .from("faculty_program_assignments")
        .select("id")
        .eq("academic_year", currentTerm.academic_year)
        .ilike("term", `%${currentTerm.semester}%`);

      const assignmentIds = (assignments ?? []).map((a: any) => a.id);

      const { data: currentTermSubs } = await supabase
        .from("submissions")
        .select("id, status, requirement_code")
        .in(
          "faculty_assignment_id",
          assignmentIds.length > 0
            ? assignmentIds
            : ["00000000-0000-0000-0000-000000000000"],
        );

      const { data: dbTemplates } = await supabase
        .from("requirement_templates")
        .select("code, is_mandatory")
        .eq("is_active", true);

      const activeMandatoryTemplates = (dbTemplates ?? []).filter(
        (t: any) => t.is_mandatory !== false,
      );
      const mandatoryReqCount =
        activeMandatoryTemplates.length > 0 ? activeMandatoryTemplates.length : 6;
      const mandatoryCodes = new Set(
        activeMandatoryTemplates.map((t: any) =>
          String(t.code).toLowerCase().trim(),
        ),
      );

      const unvalidatedSubs = (currentTermSubs ?? []).filter((s: any) => {
        if (s.status === "validated" || s.status === "approved") return false;
        const code = String(s.requirement_code || "").toLowerCase().trim();
        if (code && !mandatoryCodes.has(code)) return false;
        return true;
      });

      const expectedSubmissionsCount = (assignments ?? []).length * mandatoryReqCount;
      const validatedSubmissionsCount = (currentTermSubs ?? []).filter((s: any) => {
        if (s.status !== "validated" && s.status !== "approved") return false;
        const code = String(s.requirement_code || "").toLowerCase().trim();
        if (code && !mandatoryCodes.has(code)) return false;
        return true;
      }).length;

      const hasIncompleteRequirements =
        unvalidatedSubs.length > 0 ||
        validatedSubmissionsCount < expectedSubmissionsCount;

      // Guard 1B: Check if current semester has been backed up or archived
      const { data: currentTermRecord } = await supabase
        .from("academic_terms")
        .select("is_archived")
        .eq("academic_year", currentTerm.academic_year)
        .eq("semester", currentTerm.semester)
        .maybeSingle();

      const isArchived = Boolean(currentTermRecord?.is_archived);

      const { data: backupRows } = await supabase
        .from("system_backups")
        .select("id, backup_name, academic_year, metadata, status")
        .eq("status", "completed");

      const hasSemesterBackup =
        isArchived ||
        (backupRows ?? []).some((b: any) => {
          if (!b) return false;
          if (b.status && b.status !== "completed") return false;

          const name = (b.backup_name || "").toLowerCase();
          // Full database snapshots or All AY / All Sem backups cover all terms
          if (
            name.includes("all_ay") ||
            name.includes("all_sem") ||
            name.includes("full_database") ||
            name.includes("full_system") ||
            name.includes("all_academic") ||
            name.includes("full_snapshot")
          ) {
            return true;
          }

          const meta = b.metadata ?? {};
          const metaScope = meta.scope;

          if (
            metaScope === "full_database_snapshot" ||
            metaScope === "all" ||
            metaScope === "full"
          ) {
            return true;
          }

          // Extract academic year and semester from top-level or meta or meta.scope
          let backupAy = b.academic_year || meta.academic_year;
          let backupSem = meta.semester;

          if (typeof metaScope === "object" && metaScope !== null) {
            if (!backupAy) backupAy = metaScope.academic_year;
            if (!backupSem) backupSem = metaScope.semester;
          }

          // If no specific AY is specified or AY is 'all', it covers all academic years
          const coversAy =
            !backupAy ||
            backupAy === "all" ||
            backupAy.trim().toLowerCase() === currentTerm.academic_year.trim().toLowerCase();

          // If no specific semester is specified or semester is 'all', it covers all semesters
          const normCurrentSem = normalizeSemester(currentTerm.semester).toLowerCase();
          const normBackupSem = backupSem
            ? normalizeSemester(backupSem).toLowerCase()
            : null;

          const coversSem =
            !backupSem ||
            backupSem === "all" ||
            normBackupSem === normCurrentSem;

          if (coversAy && coversSem) {
            return true;
          }

          // Also check if backup_name contains the current term AY & Sem
          const safeAY = currentTerm.academic_year.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
          const safeSem = currentTerm.semester.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
          if (name.includes(safeAY) && (name.includes(safeSem) || name.includes("all_sem"))) {
            return true;
          }

          return false;
        });

      if (hasIncompleteRequirements || !hasSemesterBackup) {
        let errorTitle = "Requirements & Backup";
        let errorDetails = "";

        if (hasIncompleteRequirements && !hasSemesterBackup) {
          errorTitle = "Requirements & Backup";
          errorDetails =
            "The current academic term cannot be changed yet. All faculty compliance requirements must be submitted and validated, and a backup of this semester must be created in Backup & Archive.";
        } else if (hasIncompleteRequirements) {
          errorTitle = "Requirements & Backup";
          errorDetails =
            "The current academic term cannot be changed yet. All faculty compliance requirements must be submitted and validated before changing the term.";
        } else {
          errorTitle = "Requirements & Backup";
          errorDetails =
            `A backup of ${currentTerm.academic_year} (${currentTerm.semester}) must be created in Backup & Archive before changing to a new academic term.`;
        }

        return NextResponse.json(
          {
            error: errorTitle,
            details: errorDetails,
            hasIncompleteRequirements,
            missingBackup: !hasSemesterBackup,
            unvalidatedCount: unvalidatedSubs.length,
            missingCount: Math.max(
              0,
              expectedSubmissionsCount - validatedSubmissionsCount,
            ),
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
