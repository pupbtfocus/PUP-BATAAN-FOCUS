import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log-audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORAGE_BUCKETS = ["faculty-submissions", "submissions"] as const;

function isAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return (
    r === ROLE.STAFF ||
    r === ROLE.ADMIN ||
    r === ROLE.SUPER_ADMIN ||
    r === "staff" ||
    r === "super_admin" ||
    r === "superadmin"
  );
}

async function authorizeStaffOrAdmin() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) return null;

  let requesterRole =
    (user.user_metadata?.role as string | undefined) ??
    (user.app_metadata?.role as string | undefined);

  const supabase = getServiceRoleClient();

  if (!isAdminRole(requesterRole)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_roles(roles(code))")
      .eq("user_id", user.id)
      .maybeSingle();

    const userRoles = profile?.user_roles as
      | Array<{ roles: { code: string } | null }>
      | undefined;
    const dbRoleCode = userRoles?.[0]?.roles?.code;
    if (isAdminRole(dbRoleCode)) {
      requesterRole = dbRoleCode;
    }
  }

  if (!isAdminRole(requesterRole)) return null;
  return { user, supabase };
}

function normalizeAcademicYear(ay?: string | null): string {
  return (ay || "")
    .toLowerCase()
    .trim()
    .replace(/^s\.?y\.?\s*/i, "")
    .replace(/^a\.?y\.?\s*/i, "")
    .replace(/[^0-9]/g, "");
}

function normalizeSemester(sem?: string | null): string {
  const s = (sem || "").toLowerCase().trim();
  if (s.includes("2nd") || s.includes("second")) return "2nd semester";
  if (s.includes("summer")) return "summer semester";
  if (s.includes("1st") || s.includes("first")) return "1st semester";
  return s;
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
    academicYear: startsSchoolYear ? `${year}-${year + 1}` : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
  };
}

function addBucketPathCandidate(
  bucketPaths: Record<string, Set<string>>,
  rawPath?: string | null,
) {
  if (!rawPath || rawPath.startsWith("__cleaned__")) return;
  const trimmed = rawPath.replace(/^\/+/, "");
  if (!trimmed) return;

  for (const bucket of STORAGE_BUCKETS) {
    const prefix = `${bucket}/`;
    if (trimmed.startsWith(prefix)) {
      bucketPaths[bucket].add(trimmed.slice(prefix.length));
    } else {
      bucketPaths[bucket].add(trimmed);
    }
  }
}

async function resolveTermScope(
  supabase: ReturnType<typeof getServiceRoleClient>,
  academicYear: string,
  semester: string,
) {
  const targetAyNorm = normalizeAcademicYear(academicYear);
  const targetSemNorm = normalizeSemester(semester);

  const [assignmentsRes, classesRes, submissionsRes, backupsRes] =
    await Promise.all([
      supabase
        .from("faculty_program_assignments")
        .select("id, faculty_profile_id, academic_year, term"),
      supabase
        .from("faculty_classes")
        .select("id, faculty_profile_id, academic_year, semester"),
      supabase
        .from("submissions")
        .select(
          "id, faculty_profile_id, faculty_assignment_id, class_id, storage_path, file_name, size_bytes, submitted_at, created_at",
        ),
      supabase
        .from("system_backups")
        .select("id, academic_year, status, metadata, backup_name"),
    ]);

  const matchingAssignmentIds = new Set<string>();
  for (const a of assignmentsRes.data ?? []) {
    if (
      normalizeAcademicYear(a.academic_year) === targetAyNorm &&
      normalizeSemester(a.term) === targetSemNorm
    ) {
      matchingAssignmentIds.add(a.id);
    }
  }

  const matchingClassIds = new Set<string>();
  for (const c of classesRes.data ?? []) {
    if (
      normalizeAcademicYear(c.academic_year) === targetAyNorm &&
      normalizeSemester(c.semester) === targetSemNorm
    ) {
      matchingClassIds.add(c.id);
    }
  }

  const matchedSubmissions = (submissionsRes.data ?? []).filter((sub) => {
    if (sub.faculty_assignment_id && matchingAssignmentIds.has(sub.faculty_assignment_id)) {
      return true;
    }
    if (sub.class_id && matchingClassIds.has(sub.class_id)) {
      return true;
    }
    if (!sub.faculty_assignment_id && !sub.class_id) {
      const inferred = toAcademicYearAndSemester(sub.submitted_at || sub.created_at);
      return (
        normalizeAcademicYear(inferred.academicYear) === targetAyNorm &&
        normalizeSemester(inferred.semester) === targetSemNorm
      );
    }
    return false;
  });

  const submissionIds = matchedSubmissions.map((s) => s.id);

  let docVersions: Array<{
    id: string;
    submission_id: string;
    storage_path: string | null;
    size_bytes: number | null;
  }> = [];

  if (submissionIds.length > 0) {
    const { data: dvData } = await supabase
      .from("document_versions")
      .select("id, submission_id, storage_path, size_bytes")
      .in("submission_id", submissionIds);
    docVersions = dvData ?? [];
  }

  let totalSizeBytes = 0;
  let activeFileSubmissions = 0;
  for (const sub of matchedSubmissions) {
    const cleaned = sub.storage_path?.startsWith("__cleaned__");
    if (!cleaned && (sub.storage_path || (sub.size_bytes ?? 0) > 0)) {
      activeFileSubmissions += 1;
    }
    if (!cleaned && typeof sub.size_bytes === "number" && sub.size_bytes > 0) {
      totalSizeBytes += sub.size_bytes;
    }
  }
  for (const dv of docVersions) {
    if (
      dv.storage_path &&
      !dv.storage_path.startsWith("__cleaned__") &&
      typeof dv.size_bytes === "number" &&
      dv.size_bytes > 0
    ) {
      totalSizeBytes += dv.size_bytes;
    }
  }

  const isBackedUp = (backupsRes.data ?? []).some((b) => {
    if (b.status && b.status !== "completed") return false;
    const meta = (b.metadata ?? {}) as Record<string, unknown>;
    const scope =
      typeof meta.scope === "object" && meta.scope !== null
        ? (meta.scope as Record<string, unknown>)
        : {};
    const bAy = normalizeAcademicYear(
      String(b.academic_year || meta.academic_year || scope.academic_year || ""),
    );
    const bSem = normalizeSemester(String(meta.semester || scope.semester || ""));
    if (bAy === targetAyNorm && bSem && bSem !== "all" && bSem === targetSemNorm) {
      return true;
    }
    const safeAy = academicYear.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const safeSem = semester.toLowerCase().replace(/[^a-z0-9]/g, "_");
    return (b.backup_name || "").toLowerCase().includes(safeAy) &&
      (b.backup_name || "").toLowerCase().includes(safeSem);
  });

  return {
    matchedSubmissions,
    submissionIds,
    docVersions,
    matchingClassIds: Array.from(matchingClassIds),
    activeFileSubmissions,
    totalSizeBytes,
    isBackedUp,
  };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authorizeStaffOrAdmin();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const academicYear = url.searchParams.get("academic_year")?.trim() || "";
    const semester = url.searchParams.get("semester")?.trim() || "";

    if (
      !academicYear ||
      academicYear === "all" ||
      !semester ||
      semester === "all"
    ) {
      return NextResponse.json(
        { error: "Select a specific Academic Year and Semester." },
        { status: 400 },
      );
    }

    const scope = await resolveTermScope(auth.supabase, academicYear, semester);

    return NextResponse.json({
      academicYear,
      semester,
      submissionsCount: scope.matchedSubmissions.length,
      storageFilesCount: Math.max(
        scope.activeFileSubmissions,
        scope.docVersions.filter(
          (dv) => dv.storage_path && !dv.storage_path.startsWith("__cleaned__"),
        ).length,
      ),
      totalSizeBytes: scope.totalSizeBytes,
      classesCount: scope.matchingClassIds.length,
      isBackedUp: scope.isBackedUp,
    });
  } catch (error) {
    console.error("GET /api/staff/backups/clean-term error:", error);
    return NextResponse.json(
      { error: "Failed to inspect semester storage" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeStaffOrAdmin();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { user, supabase } = auth;
    const body = await request.json().catch(() => ({}));
    const academicYear = String(body.academic_year || "").trim();
    const semester = String(body.semester || "").trim();
    const mode = body.mode === "full_reset" ? "full_reset" : "files_only";

    if (
      !academicYear ||
      academicYear === "all" ||
      !semester ||
      semester === "all"
    ) {
      return NextResponse.json(
        { error: "A specific Academic Year and Semester are required." },
        { status: 400 },
      );
    }

    const scope = await resolveTermScope(supabase, academicYear, semester);

    // 1. Collect all storage object paths for the semester's submissions
    const bucketPaths: Record<(typeof STORAGE_BUCKETS)[number], Set<string>> = {
      "faculty-submissions": new Set<string>(),
      submissions: new Set<string>(),
    };

    for (const sub of scope.matchedSubmissions) {
      addBucketPathCandidate(bucketPaths, sub.storage_path);
    }
    for (const dv of scope.docVersions) {
      addBucketPathCandidate(bucketPaths, dv.storage_path);
    }

    // Also discover files in per-submission storage folders
    for (const sub of scope.matchedSubmissions) {
      if (sub.storage_path?.startsWith("__cleaned__")) continue;
      const profileId = sub.faculty_profile_id;
      const candidateFolders = [
        profileId ? `faculty-submissions/${profileId}/${sub.id}` : null,
        profileId ? `${profileId}/${sub.id}` : null,
        sub.id,
      ].filter(Boolean) as string[];

      for (const bucket of STORAGE_BUCKETS) {
        for (const folder of candidateFolders) {
          try {
            const { data: listed } = await supabase.storage
              .from(bucket)
              .list(folder, { limit: 50 });
            for (const item of listed ?? []) {
              if (item.id && item.name && !item.name.startsWith(".")) {
                bucketPaths[bucket].add(`${folder}/${item.name}`);
              }
            }
          } catch {
            // ignore folder listing errors
          }
        }
      }
    }

    // Remove storage objects in batches
    let filesRemoved = 0;
    for (const bucket of STORAGE_BUCKETS) {
      const paths = Array.from(bucketPaths[bucket]);
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        const { data: removed, error: rmError } = await supabase.storage
          .from(bucket)
          .remove(chunk);
        if (!rmError && Array.isArray(removed)) {
          filesRemoved += removed.length;
        }
      }
    }

    // 2. Apply DB cleanup while preserving all user/faculty/admin accounts
    let classesRemoved = 0;
    const subIds = scope.submissionIds;

    if (mode === "files_only") {
      if (subIds.length > 0) {
        const dvPathBySub = new Map<string, string>();
        for (const dv of scope.docVersions) {
          if (dv.storage_path && !dv.storage_path.startsWith("__cleaned__") && !dvPathBySub.has(dv.submission_id)) {
            dvPathBySub.set(dv.submission_id, dv.storage_path);
          }
        }

        await supabase.from("document_versions").delete().in("submission_id", subIds);

        await Promise.all(
          scope.matchedSubmissions.map((sub) => {
            const preservedName =
              sub.file_name ||
              (sub.storage_path && !sub.storage_path.startsWith("__cleaned__")
                ? sub.storage_path.split("/").pop()
                : null) ||
              dvPathBySub.get(sub.id)?.split("/").pop() ||
              null;
            const cleanedPath = preservedName
              ? `__cleaned__/${preservedName}`
              : "__cleaned__";
            return supabase
              .from("submissions")
              .update({
                storage_path: cleanedPath,
                ...(preservedName && !sub.file_name ? { file_name: preservedName } : {}),
                size_bytes: 0,
              })
              .eq("id", sub.id);
          }),
        );
      }
    } else {
      // full_reset: remove semester submissions, reviews, versions, extensions, and classes
      if (subIds.length > 0) {
        await supabase.from("review_decisions").delete().in("submission_id", subIds);
        await supabase.from("document_versions").delete().in("submission_id", subIds);
        await supabase
          .from("extension_requests")
          .delete()
          .in("submission_id", subIds)
          .then(
            () => null,
            () => null,
          );
        await supabase.from("submissions").delete().in("id", subIds);
      }

      if (scope.matchingClassIds.length > 0) {
        const { error: clsErr } = await supabase
          .from("faculty_classes")
          .delete()
          .in("id", scope.matchingClassIds);
        if (!clsErr) {
          classesRemoved = scope.matchingClassIds.length;
        }
      }
    }

    await logAudit({
      actorId: user.id,
      action: "backup.clean_term",
      entityType: "academic_terms",
      entityId: `${academicYear}::${semester}`,
      metadata: {
        academic_year: academicYear,
        semester,
        mode,
        files_removed: filesRemoved,
        submissions_affected: subIds.length,
        classes_removed: classesRemoved,
        freed_bytes: scope.totalSizeBytes,
      },
    });

    const summaryText =
      mode === "files_only"
        ? `Cleaned uploaded files for A.Y. ${academicYear} (${semester}). ${subIds.length} verification record(s) and all accounts were preserved.`
        : `Cleared ${subIds.length} submission(s), ${classesRemoved} class load(s), and uploaded files for A.Y. ${academicYear} (${semester}). All accounts were preserved.`;

    return NextResponse.json({
      success: true,
      mode,
      filesRemoved,
      submissionsAffected: subIds.length,
      classesRemoved,
      freedBytes: scope.totalSizeBytes,
      message: summaryText,
    });
  } catch (error) {
    console.error("POST /api/staff/backups/clean-term error:", error);
    return NextResponse.json(
      { error: "Failed to clean semester storage" },
      { status: 500 },
    );
  }
}
