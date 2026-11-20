import { NextRequest, NextResponse } from "next/server";
import { ROLE, resolveTrustedUserRole } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  isValidAcademicYear,
  isValidSemester,
  normalizeSemester,
  getTodayInManila,
  getCurrentTimeInManila,
  normalizeTime24Hour,
  isValid12HourTimeInput,
  convert12HourTo24Hour,
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
  isBackedUp?: boolean;
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

function hasCompletedBackupForTerm(
  backupRows: any[] | null | undefined,
  academicYear: string,
  semester: string,
): boolean {
  const targetAy = academicYear.trim().toLowerCase();
  const targetSem = normalizeSemester(semester).toLowerCase();

  return (backupRows ?? []).some((b: any) => {
    if (!b) return false;
    if (b.status && b.status !== "completed") return false;

    const meta = b.metadata ?? {};
    const metaScope =
      typeof meta.scope === "object" && meta.scope !== null ? meta.scope : {};

    const rawAy = b.academic_year || meta.academic_year || metaScope.academic_year;
    if (!rawAy || typeof rawAy !== "string" || rawAy.trim().toLowerCase() === "all") {
      return false;
    }
    if (rawAy.trim().toLowerCase() !== targetAy) {
      return false;
    }

    const rawSem = meta.semester || metaScope.semester;
    if (rawSem && typeof rawSem === "string" && rawSem.trim().toLowerCase() !== "all") {
      const normBSem = normalizeSemester(rawSem).toLowerCase();
      if (normBSem === targetSem) {
        return true;
      }
    }

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
}

let serverTermsCache: {
  timestamp: number;
  payload: any;
} | null = null;
const SERVER_TERMS_CACHE_TTL_MS = 15_000;

function invalidateServerTermsCache() {
  serverTermsCache = null;
}

export async function GET() {
  try {
    if (serverTermsCache && Date.now() - serverTermsCache.timestamp < SERVER_TERMS_CACHE_TTL_MS) {
      const supabase = getServiceRoleClient();
      const { data: freshBackupRows } = await supabase
        .from("system_backups")
        .select("id, backup_name, academic_year, metadata, status")
        .eq("status", "completed");

      const cachedTerms = Array.isArray(serverTermsCache.payload?.terms)
        ? serverTermsCache.payload.terms.map((t: AcademicTermResponseItem) => ({
            ...t,
            isBackedUp: hasCompletedBackupForTerm(
              freshBackupRows,
              t.academicYear,
              t.semester,
            ),
          }))
        : [];

      return NextResponse.json(
        {
          ...serverTermsCache.payload,
          terms: cachedTerms,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        },
      );
    }

    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      resolveTrustedUserRole(user);

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

    const { data: backupRows } = await supabase
      .from("system_backups")
      .select("id, backup_name, academic_year, metadata, status")
      .eq("status", "completed");

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
              isBackedUp: hasCompletedBackupForTerm(
                backupRows,
                term.academic_year,
                normalizedSemester,
              ),
              deleteReason: canDelete
                ? undefined
                : "This academic term cannot be deleted because it already contains system records.",
            };
          })
        : [];

    const payload = { terms, nextAcademicYear };
    serverTermsCache = {
      timestamp: Date.now(),
      payload,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
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
      resolveTrustedUserRole(user);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    invalidateServerTermsCache();

    const supabase = getServiceRoleClient();
    let body: any = null;
    try {
      body = await request.json();
    } catch {
      // No JSON body
    }

    if (
      (body?.action === "add_semester" || body?.action === "add_summer") &&
      body?.academicYear
    ) {
      const targetAy = String(body.academicYear).trim();
      const targetSem =
        body?.action === "add_summer"
          ? "Summer Semester"
          : normalizeSemester(body?.semester);

      if (!isValidAcademicYear(targetAy) || !isValidSemester(targetSem)) {
        return NextResponse.json(
          { error: "Invalid academic year or semester." },
          { status: 400 },
        );
      }

      const { data: allTermsForCheck } = await supabase
        .from("academic_terms")
        .select("academic_year, semester, status");

      const existingRows = Array.isArray(allTermsForCheck) ? allTermsForCheck : [];
      const alreadyExists = existingRows.some(
        (r) =>
          r.academic_year === targetAy &&
          normalizeSemester(r.semester) === targetSem,
      );

      if (alreadyExists) {
        return NextResponse.json(
          { error: `${targetSem} already exists for A.Y. ${targetAy}.` },
          { status: 409 },
        );
      }

      const activeCurrent = existingRows.find((r) => r.status === "Current");
      if (
        activeCurrent &&
        getTermScore(targetAy, targetSem) <=
          getTermScore(activeCurrent.academic_year, activeCurrent.semester)
      ) {
        return NextResponse.json(
          {
            error:
              "Cannot restore a past semester that precedes or matches the active term.",
          },
          { status: 400 },
        );
      }

      const { error: insertErr } = await supabase
        .from("academic_terms")
        .insert({
          academic_year: targetAy,
          semester: targetSem,
          status: activeCurrent ? "Upcoming" : "Current",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (insertErr) {
        return NextResponse.json(
          {
            error: `Failed to add ${targetSem}`,
            details: insertErr.message,
          },
          { status: 500 },
        );
      }

      void logTransactionEvent({
        actorId: user.id,
        action: "academic_term.semester_restore",
        entityType: "academic_term",
        entityId: user.id,
        metadata: { academic_year: targetAy, semester: targetSem },
      });

      return NextResponse.json({
        success: true,
        added: true,
        academicYear: targetAy,
        semester: targetSem,
      });
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
      resolveTrustedUserRole(user);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const academicYear = url.searchParams.get("academicYear")?.trim() ?? "";
    const semester = normalizeSemester(url.searchParams.get("semester"));
    const action = url.searchParams.get("action");
    const checkOnly = url.searchParams.get("checkOnly") === "1";

    if (!checkOnly) {
      invalidateServerTermsCache();
    }

    if (!isValidAcademicYear(academicYear) || !isValidSemester(semester)) {
      return NextResponse.json(
        { error: "Invalid academic year or semester." },
        { status: 400 },
      );
    }

    if (action === "archive") {
      const supabase = getServiceRoleClient();

      const { data: targetTerm, error: termErr } = await supabase
        .from("academic_terms")
        .select("academic_year, semester, status")
        .match({ academic_year: academicYear, semester })
        .maybeSingle();

      if (termErr || !targetTerm) {
        return NextResponse.json(
          { error: "Academic term not found." },
          { status: 404 },
        );
      }

      if (
        targetTerm.status === "Archived" ||
        (targetTerm.status as string) === "Completed"
      ) {
        return NextResponse.json(
          { error: "Academic term is already archived." },
          { status: 400 },
        );
      }

      // Guard 0: Check pending requirement reviews before archiving
      const { data: currentAssignments } = await supabase
        .from("faculty_program_assignments")
        .select("id, faculty_profile_id")
        .eq("academic_year", academicYear)
        .ilike("term", `%${semester}%`);

      const currentAssignmentIds = (currentAssignments || []).map((a: any) => a.id).filter(Boolean);
      const currentProfileIds = Array.from(
        new Set((currentAssignments || []).map((a: any) => a.faculty_profile_id).filter(Boolean)),
      );

      let currentClassIds: string[] = [];
      try {
        const { data: currentClasses } = await supabase
          .from("faculty_classes")
          .select("id")
          .eq("academic_year", academicYear)
          .ilike("semester", `%${semester}%`);
        if (currentClasses) {
          currentClassIds = currentClasses.map((c: any) => c.id).filter(Boolean);
        }
      } catch {}

      const orConditions: string[] = [];
      if (currentAssignmentIds.length > 0) {
        orConditions.push(`faculty_assignment_id.in.(${currentAssignmentIds.join(",")})`);
      }
      if (currentClassIds.length > 0) {
        orConditions.push(`class_id.in.(${currentClassIds.join(",")})`);
      }
      if (currentProfileIds.length > 0) {
        orConditions.push(`faculty_profile_id.in.(${currentProfileIds.join(",")})`);
      }

      let pendingSubmissionsCount = 0;
      if (orConditions.length > 0) {
        const { data: termSubmissions, error: subQueryErr } = await supabase
          .from("submissions")
          .select("id, status, submitted_at, faculty_assignment_id, class_id, faculty_profile_id")
          .or(orConditions.join(","))
          .limit(3000);

        if (!subQueryErr && termSubmissions) {
          const reviewedStatuses = new Set([
            "validated",
            "approved",
            "rejected",
            "needs_revision",
            "returned",
            "revision_required",
            "revision",
            "exempted",
            "exempt",
            "draft",
            "not_submitted",
          ]);

          for (const sub of termSubmissions) {
            const isDirectAssignment = sub.faculty_assignment_id && currentAssignmentIds.includes(sub.faculty_assignment_id);
            const isDirectClass = sub.class_id && currentClassIds.includes(sub.class_id);
            const isAssignedProfile = sub.faculty_profile_id && currentProfileIds.includes(sub.faculty_profile_id);

            if (!isDirectAssignment && !isDirectClass && !isAssignedProfile) {
              continue;
            }

            const rawStatus = (sub.status || "").toLowerCase().trim();
            if (reviewedStatuses.has(rawStatus)) {
              continue;
            }

            if (
              rawStatus === "uploaded" ||
              rawStatus === "submitted" ||
              rawStatus === "pending" ||
              rawStatus === "under_review" ||
              rawStatus === "pending_review" ||
              Boolean(sub.submitted_at)
            ) {
              pendingSubmissionsCount++;
            }
          }
        }
      }

      // Guard 1: Check semester backup status alongside pending reviews
      const { data: backupRows } = await supabase
        .from("system_backups")
        .select("id, backup_name, academic_year, metadata, status")
        .eq("status", "completed");

      const hasSemesterBackup = hasCompletedBackupForTerm(
        backupRows,
        academicYear,
        semester,
      );

      if (pendingSubmissionsCount > 0) {
        return NextResponse.json(
          {
            error: "Pending Requirement Reviews Required",
            details: `Cannot archive academic term: There ${pendingSubmissionsCount === 1 ? "is" : "are"} ${pendingSubmissionsCount} submitted requirement${pendingSubmissionsCount !== 1 ? "s" : ""} pending review in S.Y. ${academicYear} (${semester}). Please review all submitted requirements before you can archive or close this academic term.`,
            pendingReviews: true,
            pendingCount: pendingSubmissionsCount,
            missingBackup: !hasSemesterBackup,
            academicYear,
            semester,
          },
          { status: 400 },
        );
      }

      if (!hasSemesterBackup) {
        return NextResponse.json(
          {
            error: "Semester Backup Required",
            details: `A backup of S.Y. ${academicYear} (${semester}) must be created in Backup & Archive before you can archive or close this academic term. Backups are required per semester.`,
            missingBackup: true,
            academicYear,
            semester,
          },
          { status: 400 },
        );
      }

      if (checkOnly) {
        return NextResponse.json({ ready: true });
      }

      const { error: archiveError } = await supabase
        .from("academic_terms")
        .update({
          status: "Archived",
          updated_at: new Date().toISOString(),
        })
        .match({ academic_year: academicYear, semester });

      if (archiveError) {
        return NextResponse.json(
          {
            error: "Failed to archive academic term",
            details: archiveError.message,
          },
          { status: 500 },
        );
      }

      try {
        const { data: assignments } = await supabase
          .from("faculty_program_assignments")
          .select("id")
          .eq("academic_year", academicYear)
          .ilike("term", `%${semester}%`);

        if (assignments && assignments.length > 0) {
          const assignmentIds = assignments
            .map((a: any) => a.id)
            .filter(Boolean);
          await supabase
            .from("submissions")
            .update({ is_archived: true })
            .in("faculty_assignment_id", assignmentIds);
        }
      } catch (termArchiveErr) {
        console.warn("Failed to archive submissions:", termArchiveErr);
      }

      await supabase
        .from("submission_windows")
        .delete()
        .eq("id", 1);

      await supabase
        .from("submission_window_terms")
        .update({
          start_date: null,
          end_date: null,
          start_time: null,
          end_time: null,
        })
        .eq("academic_year", academicYear)
        .eq("semester", semester);

      void logTransactionEvent({
        actorId: user.id,
        action: "academic_term.archive",
        entityType: "academic_term",
        entityId: user.id,
        metadata: { academic_year: academicYear, semester },
      });

      return NextResponse.json({
        success: true,
        archived: true,
        message: `Successfully archived S.Y. ${academicYear} (${semester}).`,
      });
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
      // Guard 0: Strictly prevent changing the active term if there are submitted requirements pending review
      const { data: currentAssignments } = await supabase
        .from("faculty_program_assignments")
        .select("id, faculty_profile_id")
        .eq("academic_year", currentTerm.academic_year)
        .ilike("term", `%${currentTerm.semester}%`);

      const currentAssignmentIds = (currentAssignments || []).map((a: any) => a.id).filter(Boolean);
      const currentProfileIds = Array.from(
        new Set((currentAssignments || []).map((a: any) => a.faculty_profile_id).filter(Boolean)),
      );

      let currentClassIds: string[] = [];
      try {
        const { data: currentClasses } = await supabase
          .from("faculty_classes")
          .select("id")
          .eq("academic_year", currentTerm.academic_year)
          .ilike("semester", `%${currentTerm.semester}%`);
        if (currentClasses) {
          currentClassIds = currentClasses.map((c: any) => c.id).filter(Boolean);
        }
      } catch {}

      const orConditions: string[] = [];
      if (currentAssignmentIds.length > 0) {
        orConditions.push(`faculty_assignment_id.in.(${currentAssignmentIds.join(",")})`);
      }
      if (currentClassIds.length > 0) {
        orConditions.push(`class_id.in.(${currentClassIds.join(",")})`);
      }
      if (currentProfileIds.length > 0) {
        orConditions.push(`faculty_profile_id.in.(${currentProfileIds.join(",")})`);
      }

      let pendingSubmissionsCount = 0;
      if (orConditions.length > 0) {
        const { data: termSubmissions, error: subQueryErr } = await supabase
          .from("submissions")
          .select("id, status, submitted_at, faculty_assignment_id, class_id, faculty_profile_id")
          .or(orConditions.join(","))
          .limit(3000);

        if (!subQueryErr && termSubmissions) {
          const reviewedStatuses = new Set([
            "validated",
            "approved",
            "rejected",
            "needs_revision",
            "returned",
            "revision_required",
            "revision",
            "exempted",
            "exempt",
            "draft",
            "not_submitted",
          ]);

          for (const sub of termSubmissions) {
            const isDirectAssignment = sub.faculty_assignment_id && currentAssignmentIds.includes(sub.faculty_assignment_id);
            const isDirectClass = sub.class_id && currentClassIds.includes(sub.class_id);
            const isAssignedProfile = sub.faculty_profile_id && currentProfileIds.includes(sub.faculty_profile_id);

            if (!isDirectAssignment && !isDirectClass && !isAssignedProfile) {
              continue;
            }

            const rawStatus = (sub.status || "").toLowerCase().trim();
            if (reviewedStatuses.has(rawStatus)) {
              continue;
            }

            if (
              rawStatus === "uploaded" ||
              rawStatus === "submitted" ||
              rawStatus === "pending" ||
              rawStatus === "under_review" ||
              rawStatus === "pending_review" ||
              Boolean(sub.submitted_at)
            ) {
              pendingSubmissionsCount++;
            }
          }
        }
      }

      // Guard 1: Check semester backup status alongside pending reviews
      const { data: backupRows } = await supabase
        .from("system_backups")
        .select("id, backup_name, academic_year, metadata, status")
        .eq("status", "completed");

      const hasSemesterBackup = hasCompletedBackupForTerm(
        backupRows,
        currentTerm.academic_year,
        currentTerm.semester,
      );

      if (pendingSubmissionsCount > 0) {
        return NextResponse.json(
          {
            error: "Pending Requirement Reviews Required",
            details: `Cannot change academic term: There ${pendingSubmissionsCount === 1 ? "is" : "are"} ${pendingSubmissionsCount} submitted requirement${pendingSubmissionsCount !== 1 ? "s" : ""} pending review in S.Y. ${currentTerm.academic_year} (${currentTerm.semester}). Please review all submitted requirements (validate or reject) before you can change to a new Academic Year and Semester.`,
            pendingReviews: true,
            pendingCount: pendingSubmissionsCount,
            missingBackup: !hasSemesterBackup,
            academicYear: currentTerm.academic_year,
            semester: currentTerm.semester,
          },
          { status: 400 },
        );
      }

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

    if (checkOnly) {
      return NextResponse.json({ ready: true });
    }

    const todayManila = getTodayInManila();
    const timeManila = getCurrentTimeInManila();
    const nowDateTime = `${todayManila}T${timeManila}`;

    // Inspect active submission window BEFORE switching terms
    const { data: existingWin } = await supabase
      .from("submission_windows")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    let hasCurrentlyOpenSchedule = false;
    if (existingWin?.start_date && existingWin?.end_date) {
      const startIso = `${existingWin.start_date}T${normalizeTime24Hour(existingWin.start_time || "00:00:00")}`;
      const endIso = `${existingWin.end_date}T${normalizeTime24Hour(existingWin.end_time || "23:59:59")}`;
      hasCurrentlyOpenSchedule = nowDateTime >= startIso && nowDateTime <= endIso;
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

    // Archive previous term submissions so new term starts with a clean slate and avoids unique active submission collisions
    if (currentTerm?.academic_year) {
      try {
        const { data: prevAssignments } = await supabase
          .from("faculty_program_assignments")
          .select("id")
          .eq("academic_year", currentTerm.academic_year)
          .ilike("term", `%${currentTerm.semester}%`);

        if (prevAssignments && prevAssignments.length > 0) {
          const prevAssignmentIds = prevAssignments.map((a: any) => a.id).filter(Boolean);
          await supabase
            .from("submissions")
            .update({ is_archived: true })
            .in("faculty_assignment_id", prevAssignmentIds);
        }
      } catch (termArchiveErr) {
        console.warn("Failed to archive previous term submissions:", termArchiveErr);
      }
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

    // Sync the active submission window for the newly activated term
    const { data: targetTermSchedule } = await supabase
      .from("submission_window_terms")
      .select("start_date, end_date, start_time, end_time")
      .eq("academic_year", academicYear)
      .eq("semester", semester)
      .maybeSingle();

    if (targetTermSchedule?.start_date && targetTermSchedule?.end_date) {
      const rawStart = targetTermSchedule.start_time || "09:00:00";
      const rawEnd = targetTermSchedule.end_time || "17:00:00";
      const startTime24 = isValid12HourTimeInput(rawStart)
        ? convert12HourTo24Hour(rawStart)
        : normalizeTime24Hour(rawStart) || "09:00:00";
      const endTime24 = isValid12HourTimeInput(rawEnd)
        ? convert12HourTo24Hour(rawEnd)
        : normalizeTime24Hour(rawEnd) || "17:00:00";

      // The newly activated term has a configured schedule: activate it in submission_windows id=1
      await supabase.from("submission_windows").upsert(
        {
          id: 1,
          start_date: targetTermSchedule.start_date,
          end_date: targetTermSchedule.end_date,
          start_time: startTime24,
          end_time: endTime24,
          academic_year: academicYear,
          semester,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    } else {
      // No schedule configured yet for this term: remove row 1 so it correctly shows as unconfigured
      await supabase.from("submission_windows").delete().eq("id", 1);
    }

    void logTransactionEvent({
      actorId: user.id,
      action: "academic_term.set_current",
      entityType: "academic_term",
      entityId: user.id,
      metadata: { academic_year: academicYear, semester },
    });

    return NextResponse.json({
      success: true,
      closedSchedule: hasCurrentlyOpenSchedule,
    });
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
      resolveTrustedUserRole(user);

    if (!user || !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    invalidateServerTermsCache();

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
    const { data: yearTerms, error: fetchTermErr } = await supabase
      .from("academic_terms")
      .select("academic_year, semester, status")
      .eq("academic_year", academicYear);

    if (fetchTermErr) {
      return NextResponse.json(
        {
          error: "Failed to verify academic term",
          details: fetchTermErr.message,
        },
        { status: 500 },
      );
    }

    const matchingRows = (yearTerms ?? []).filter(
      (r) => normalizeSemester(r.semester) === semester,
    );

    if (matchingRows.length === 0) {
      return NextResponse.json(
        { error: "Academic term not found." },
        { status: 404 },
      );
    }

    if (matchingRows.some((r) => r.status === "Current")) {
      return NextResponse.json(
        { error: "Cannot delete the currently active academic term." },
        { status: 400 },
      );
    }

    const { data: assignmentRows, error: assignmentError } = await supabase
      .from("faculty_program_assignments")
      .select("id, term")
      .eq("academic_year", academicYear);

    if (assignmentError) {
      return NextResponse.json(
        {
          error: "Failed to validate academic term dependencies",
          details: assignmentError.message,
        },
        { status: 500 },
      );
    }

    const hasMatchingAssignments = (assignmentRows ?? []).some(
      (a: any) => normalizeSemester(a.term) === semester,
    );

    if (hasMatchingAssignments) {
      return NextResponse.json(
        {
          error:
            "This academic term cannot be deleted because it already contains system records.",
        },
        { status: 400 },
      );
    }

    const exactSemesterValues = Array.from(
      new Set(matchingRows.map((r) => r.semester)),
    );

    const { error: deleteError } = await supabase
      .from("academic_terms")
      .delete()
      .eq("academic_year", academicYear)
      .in("semester", exactSemesterValues);

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
      .from("submission_window_terms")
      .delete()
      .eq("academic_year", academicYear)
      .in("semester", exactSemesterValues);

    await supabase
      .from("submission_windows")
      .update({ academic_year: null, semester: null })
      .eq("id", 1)
      .eq("academic_year", academicYear)
      .in("semester", exactSemesterValues);

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
