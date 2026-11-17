import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log-audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SUBMISSION_BUCKETS = ["faculty-submissions", "submissions"];

type BucketFileInfo = {
  bucket: string;
  path: string;
  sizeBytes: number;
  createdAt: string | null;
};

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

async function listNonAvatarBuckets(
  supabase: ReturnType<typeof getServiceRoleClient>,
): Promise<string[]> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (!error && Array.isArray(buckets) && buckets.length > 0) {
      const names = buckets
        .map((b) => b.name)
        .filter((name) => name && name.toLowerCase() !== "avatars");
      if (names.length > 0) return names;
    }
  } catch {
    // fallback below
  }
  return DEFAULT_SUBMISSION_BUCKETS;
}

async function listBucketFilesRecursive(
  supabase: ReturnType<typeof getServiceRoleClient>,
  bucket: string,
  prefix = "",
  depth = 0,
): Promise<BucketFileInfo[]> {
  if (depth > 6) return [];
  const results: BucketFileInfo[] = [];

  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset });

    if (error || !Array.isArray(data) || data.length === 0) break;

    for (const item of data) {
      if (!item.name || item.name === ".emptyFolderPlaceholder") continue;
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.id) {
        const nested = await listBucketFilesRecursive(
          supabase,
          bucket,
          fullPath,
          depth + 1,
        );
        results.push(...nested);
      } else {
        const meta = (item.metadata ?? {}) as Record<string, unknown>;
        const sizeBytes = Number(meta.size ?? meta.contentLength ?? 0) || 0;
        results.push({
          bucket,
          path: fullPath,
          sizeBytes,
          createdAt: item.created_at ?? null,
        });
      }
    }

    if (data.length < 1000) break;
  }

  return results;
}

function addPathVariants(set: Set<string>, rawPath?: string | null) {
  if (!rawPath || rawPath.startsWith("__cleaned__")) return;
  const trimmed = rawPath.replace(/^\/+/, "");
  if (!trimmed) return;
  // Keep both exact path (e.g. "faculty-submissions/...") and bucket-stripped path
  set.add(trimmed);
  for (const bucket of DEFAULT_SUBMISSION_BUCKETS) {
    const prefix = `${bucket}/`;
    if (trimmed.startsWith(prefix)) {
      set.add(trimmed.slice(prefix.length));
    }
  }
}

async function fetchSubmissionsSafe(
  supabase: ReturnType<typeof getServiceRoleClient>,
) {
  const primary = await supabase
    .from("submissions")
    .select(
      "id, faculty_profile_id, faculty_assignment_id, class_id, requirement_code, storage_path, file_name, size_bytes, submitted_at, created_at",
    );

  if (!primary.error) {
    return (primary.data ?? []) as Array<{
      id: string;
      faculty_profile_id?: string | null;
      faculty_assignment_id?: string | null;
      class_id?: string | null;
      requirement_code?: string | null;
      storage_path?: string | null;
      file_name?: string | null;
      size_bytes?: number | null;
      submitted_at?: string | null;
      created_at?: string | null;
    }>;
  }

  const fallback = await supabase
    .from("submissions")
    .select(
      "id, faculty_profile_id, faculty_assignment_id, class_id, requirement_code, submitted_at, created_at",
    );

  return (fallback.data ?? []) as Array<{
    id: string;
    faculty_profile_id?: string | null;
    faculty_assignment_id?: string | null;
    class_id?: string | null;
    requirement_code?: string | null;
    storage_path?: string | null;
    file_name?: string | null;
    size_bytes?: number | null;
    submitted_at?: string | null;
    created_at?: string | null;
  }>;
}

async function resolveTermScope(
  supabase: ReturnType<typeof getServiceRoleClient>,
  academicYear: string,
  semester: string,
) {
  const targetAyNorm = normalizeAcademicYear(academicYear);
  const targetSemNorm = normalizeSemester(semester);

  const [assignmentsRes, classesRes, allSubmissions, termsRes, backupsRes, buckets] =
    await Promise.all([
      supabase
        .from("faculty_program_assignments")
        .select("id, faculty_profile_id, academic_year, term"),
      supabase
        .from("faculty_classes")
        .select("id, faculty_profile_id, academic_year, semester"),
      fetchSubmissionsSafe(supabase),
      supabase
        .from("academic_terms")
        .select("academic_year, semester, status, created_at")
        .order("created_at", { ascending: true }),
      supabase
        .from("system_backups")
        .select("id, academic_year, status, metadata, backup_name"),
      listNonAvatarBuckets(supabase),
    ]);

  const matchingAssignmentIds = new Set<string>();
  const targetTermProfileIds = new Set<string>();
  for (const a of assignmentsRes.data ?? []) {
    if (
      normalizeAcademicYear(a.academic_year) === targetAyNorm &&
      normalizeSemester(a.term) === targetSemNorm
    ) {
      matchingAssignmentIds.add(a.id);
      if (a.faculty_profile_id) targetTermProfileIds.add(a.faculty_profile_id);
    }
  }

  const matchingClassIds = new Set<string>();
  for (const c of classesRes.data ?? []) {
    if (
      normalizeAcademicYear(c.academic_year) === targetAyNorm &&
      normalizeSemester(c.semester) === targetSemNorm
    ) {
      matchingClassIds.add(c.id);
      if (c.faculty_profile_id) targetTermProfileIds.add(c.faculty_profile_id);
    }
  }

  const matchedSubmissions: typeof allSubmissions = [];
  const otherTermSubmissions: typeof allSubmissions = [];

  for (const sub of allSubmissions) {
    let belongsToTarget = false;
    if (sub.faculty_assignment_id && matchingAssignmentIds.has(sub.faculty_assignment_id)) {
      belongsToTarget = true;
    } else if (sub.class_id && matchingClassIds.has(sub.class_id)) {
      belongsToTarget = true;
    } else if (!sub.faculty_assignment_id && !sub.class_id) {
      const inferred = toAcademicYearAndSemester(sub.submitted_at || sub.created_at);
      belongsToTarget =
        normalizeAcademicYear(inferred.academicYear) === targetAyNorm &&
        normalizeSemester(inferred.semester) === targetSemNorm;
    }

    if (belongsToTarget) matchedSubmissions.push(sub);
    else otherTermSubmissions.push(sub);
  }

  const submissionIds = matchedSubmissions.map((s) => s.id);
  const targetSubIdSet = new Set(submissionIds);
  const otherSubIdSet = new Set(otherTermSubmissions.map((s) => s.id));

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

  // Scan actual Supabase Storage buckets so reported size/count is accurate
  const allBucketFiles = (
    await Promise.all(
      buckets.map((bucket) => listBucketFilesRecursive(supabase, bucket)),
    )
  ).flat();

  const knownTargetPaths = new Set<string>();
  for (const sub of matchedSubmissions) {
    addPathVariants(knownTargetPaths, sub.storage_path);
  }
  for (const dv of docVersions) {
    addPathVariants(knownTargetPaths, dv.storage_path);
  }

  const knownOtherPaths = new Set<string>();
  for (const sub of otherTermSubmissions) {
    addPathVariants(knownOtherPaths, sub.storage_path);
  }

  const termStorageFiles: BucketFileInfo[] = [];
  const orphanedStorageFiles: BucketFileInfo[] = [];

  for (const file of allBucketFiles) {
    const matchesTargetPath =
      knownTargetPaths.has(file.path) ||
      Array.from(targetSubIdSet).some(
        (subId) =>
          file.path.includes(`/${subId}/`) || file.path.startsWith(`${subId}/`),
      );

    if (matchesTargetPath) {
      termStorageFiles.push(file);
      continue;
    }

    const matchesOtherTerm =
      knownOtherPaths.has(file.path) ||
      Array.from(otherSubIdSet).some(
        (subId) =>
          file.path.includes(`/${subId}/`) || file.path.startsWith(`${subId}/`),
      );

    if (!matchesOtherTerm) {
      // Unlinked/orphaned file in Storage (or belongs to deleted submissions)
      orphanedStorageFiles.push(file);
    }
  }

  // Determine semester window for transaction_logs & notifications
  const orderedTerms = termsRes.data ?? [];
  const targetTermIdx = orderedTerms.findIndex(
    (t) =>
      normalizeAcademicYear(t.academic_year) === targetAyNorm &&
      normalizeSemester(t.semester) === targetSemNorm,
  );
  const isSingleTermSystem = orderedTerms.length <= 1;
  const termStartIso =
    targetTermIdx > 0 ? orderedTerms[targetTermIdx]?.created_at ?? null : null;
  const termEndIso =
    targetTermIdx >= 0 && targetTermIdx < orderedTerms.length - 1
      ? orderedTerms[targetTermIdx + 1]?.created_at ?? null
      : null;

  const isInTermDateWindow = (iso?: string | null) => {
    if (!iso) return false;
    if (isSingleTermSystem) return true;
    const ms = new Date(iso).getTime();
    if (Number.isNaN(ms)) return false;
    if (termStartIso && ms < new Date(termStartIso).getTime()) return false;
    if (termEndIso && ms >= new Date(termEndIso).getTime()) return false;
    if (targetTermIdx === -1) {
      const inferred = toAcademicYearAndSemester(iso);
      return (
        normalizeAcademicYear(inferred.academicYear) === targetAyNorm &&
        normalizeSemester(inferred.semester) === targetSemNorm
      );
    }
    return true;
  };

  let txLogTable: "transaction_logs" | "audit_logs" = "transaction_logs";
  let txRows: Array<{
    id: string;
    entity_id?: string | null;
    metadata?: Record<string, unknown> | null;
    created_at?: string | null;
  }> = [];

  const txPrimary = await supabase
    .from("transaction_logs")
    .select("id, entity_id, metadata, created_at");

  if (txPrimary.error && (txPrimary.error.code === "42P01" || txPrimary.error.message.includes("does not exist"))) {
    txLogTable = "audit_logs";
    const txFallback = await supabase
      .from("audit_logs")
      .select("id, entity_id, metadata, created_at");
    txRows = (txFallback.data ?? []) as typeof txRows;
  } else {
    txRows = (txPrimary.data ?? []) as typeof txRows;
  }

  const matchedTxIds: string[] = [];
  for (const row of txRows) {
    const meta = row.metadata ?? {};
    const metaAy = normalizeAcademicYear(String(meta.academic_year ?? ""));
    const metaSem = normalizeSemester(String(meta.semester ?? ""));
    const metaMatches =
      metaAy === targetAyNorm && (!metaSem || metaSem === targetSemNorm);
    const entityMatches = Boolean(
      row.entity_id &&
        (targetSubIdSet.has(row.entity_id) ||
          matchingClassIds.has(row.entity_id) ||
          row.entity_id === `${academicYear}::${semester}`),
    );
    if (metaMatches || entityMatches || isInTermDateWindow(row.created_at)) {
      matchedTxIds.push(row.id);
    }
  }

  const { data: notifRows } = await supabase
    .from("notifications")
    .select("id, created_at");

  const matchedNotifIds = (notifRows ?? [])
    .filter((n) => isSingleTermSystem || isInTermDateWindow(n.created_at))
    .map((n) => n.id);

  let matchedExtensionIds: string[] = [];
  try {
    const { data: extRows, error: extErr } = await supabase
      .from("extension_requests")
      .select("id, academic_year, semester, created_at");

    if (!extErr && Array.isArray(extRows)) {
      matchedExtensionIds = extRows
        .filter((r) => {
          const rAy = normalizeAcademicYear(r.academic_year);
          const rSem = normalizeSemester(r.semester);
          if (rAy && rSem) {
            return rAy === targetAyNorm && rSem === targetSemNorm;
          }
          return isSingleTermSystem || isInTermDateWindow(r.created_at);
        })
        .map((r) => r.id);
    }
  } catch {
    // extension_requests table optional
  }

  let matchedKeepaliveIds: string[] = [];
  try {
    const { data: kaRows, error: kaErr } = await supabase
      .from("cron_keepalive_logs")
      .select("id, executed_at");

    if (!kaErr && Array.isArray(kaRows)) {
      matchedKeepaliveIds = kaRows
        .filter((k) => isSingleTermSystem || isInTermDateWindow(k.executed_at))
        .map((k) => k.id);
    }
  } catch {
    // cron_keepalive_logs table optional
  }

  const termBytes = termStorageFiles.reduce((acc, f) => acc + f.sizeBytes, 0);
  const orphanBytes = orphanedStorageFiles.reduce((acc, f) => acc + f.sizeBytes, 0);

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
    return (
      (b.backup_name || "").toLowerCase().includes(safeAy) &&
      (b.backup_name || "").toLowerCase().includes(safeSem)
    );
  });

  return {
    matchedSubmissions,
    submissionIds,
    docVersions,
    matchingClassIds: Array.from(matchingClassIds),
    termStorageFiles,
    orphanedStorageFiles,
    termBytes,
    orphanBytes,
    txLogTable,
    matchedTxIds,
    matchedNotifIds,
    matchedExtensionIds,
    matchedKeepaliveIds,
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
      storageFilesCount: scope.termStorageFiles.length,
      orphanedFilesCount: scope.orphanedStorageFiles.length,
      totalSizeBytes: scope.termBytes,
      orphanedSizeBytes: scope.orphanBytes,
      classesCount: scope.matchingClassIds.length,
      transactionLogsCount: scope.matchedTxIds.length,
      notificationsCount: scope.matchedNotifIds.length,
      extensionRequestsCount: scope.matchedExtensionIds.length,
      keepaliveLogsCount: scope.matchedKeepaliveIds.length,
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
    const includeOrphanStorage = body.include_orphan_storage !== false;
    const cleanLogsAndNotifications = body.clean_logs_and_notifications !== false;
    const confirmText = String(body.confirm_text || "").trim().toLowerCase();
    const adminPassword = String(body.password || "");

    if (confirmText !== "delete") {
      return NextResponse.json(
        { error: 'Please type "delete" to confirm.' },
        { status: 400 },
      );
    }

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Admin password is required." },
        { status: 400 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Unable to verify admin account email." },
        { status: 400 },
      );
    }

    const authCheckClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: pwErr } = await authCheckClient.auth.signInWithPassword({
      email: user.email,
      password: adminPassword,
    });
    if (pwErr) {
      return NextResponse.json(
        { error: "Incorrect admin password." },
        { status: 401 },
      );
    }

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

    // 1. Delete matched Storage files (and orphaned Storage files if enabled; never touches avatars)
    const filesToDelete = includeOrphanStorage
      ? [...scope.termStorageFiles, ...scope.orphanedStorageFiles]
      : scope.termStorageFiles;

    const pathsByBucket = new Map<string, string[]>();
    for (const f of filesToDelete) {
      if (!pathsByBucket.has(f.bucket)) pathsByBucket.set(f.bucket, []);
      pathsByBucket.get(f.bucket)!.push(f.path);
    }

    let filesRemoved = 0;
    for (const [bucket, paths] of pathsByBucket.entries()) {
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

    // 2. Apply DB cleanup (DELETE rows only — keeps tables and all accounts intact)
    let classesRemoved = 0;
    let txLogsRemoved = 0;
    let notificationsRemoved = 0;
    let extensionsRemoved = 0;
    let keepaliveLogsRemoved = 0;
    const subIds = scope.submissionIds;

    if (mode === "files_only") {
      if (subIds.length > 0) {
        const dvPathBySub = new Map<string, string>();
        for (const dv of scope.docVersions) {
          if (
            dv.storage_path &&
            !dv.storage_path.startsWith("__cleaned__") &&
            !dvPathBySub.has(dv.submission_id)
          ) {
            dvPathBySub.set(dv.submission_id, dv.storage_path);
          }
        }

        await supabase
          .from("document_versions")
          .delete()
          .in("submission_id", subIds)
          .then(() => null, () => null);

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
                ...(preservedName && !sub.file_name
                  ? { file_name: preservedName }
                  : {}),
                size_bytes: 0,
              })
              .eq("id", sub.id)
              .then(() => null, () => null);
          }),
        );
      }
    } else {
      if (subIds.length > 0) {
        await supabase.from("review_decisions").delete().in("submission_id", subIds);
        await supabase.from("document_versions").delete().in("submission_id", subIds);
        await supabase
          .from("extension_requests")
          .delete()
          .in("submission_id", subIds)
          .then(() => null, () => null);
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

    // 3. Delete semester transaction_logs, notifications, and extension_requests rows (tables preserved)
    if (cleanLogsAndNotifications) {
      for (let i = 0; i < scope.matchedTxIds.length; i += 200) {
        const chunk = scope.matchedTxIds.slice(i, i + 200);
        const { error: txDelErr } = await supabase
          .from(scope.txLogTable)
          .delete()
          .in("id", chunk);
        if (!txDelErr) txLogsRemoved += chunk.length;
      }

      for (let i = 0; i < scope.matchedNotifIds.length; i += 200) {
        const chunk = scope.matchedNotifIds.slice(i, i + 200);
        const { error: notifDelErr } = await supabase
          .from("notifications")
          .delete()
          .in("id", chunk);
        if (!notifDelErr) notificationsRemoved += chunk.length;
      }

      for (let i = 0; i < scope.matchedExtensionIds.length; i += 200) {
        const chunk = scope.matchedExtensionIds.slice(i, i + 200);
        const { error: extDelErr } = await supabase
          .from("extension_requests")
          .delete()
          .in("id", chunk);
        if (!extDelErr) extensionsRemoved += chunk.length;
      }

      for (let i = 0; i < scope.matchedKeepaliveIds.length; i += 200) {
        const chunk = scope.matchedKeepaliveIds.slice(i, i + 200);
        const { error: kaDelErr } = await supabase
          .from("cron_keepalive_logs")
          .delete()
          .in("id", chunk);
        if (!kaDelErr) keepaliveLogsRemoved += chunk.length;
      }
    }

    const freedBytes = filesToDelete.reduce((acc, f) => acc + f.sizeBytes, 0);

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
        transaction_logs_removed: txLogsRemoved,
        notifications_removed: notificationsRemoved,
        extension_requests_removed: extensionsRemoved,
        keepalive_logs_removed: keepaliveLogsRemoved,
        freed_bytes: freedBytes,
      },
    });

    const extraSummary = cleanLogsAndNotifications
      ? ` Cleared ${txLogsRemoved} log(s), ${notificationsRemoved} notification(s), ${extensionsRemoved} extension request(s), and ${keepaliveLogsRemoved} keep-alive log(s).`
      : "";

    const summaryText =
      mode === "files_only"
        ? `Removed ${filesRemoved} file(s) from Storage for A.Y. ${academicYear} (${semester}).${extraSummary} Verification records and all accounts were preserved.`
        : `Removed ${filesRemoved} file(s), ${subIds.length} submission(s), and ${classesRemoved} class load(s) for A.Y. ${academicYear} (${semester}).${extraSummary} All accounts and tables were preserved.`;

    return NextResponse.json({
      success: true,
      mode,
      filesRemoved,
      submissionsAffected: subIds.length,
      classesRemoved,
      transactionLogsRemoved: txLogsRemoved,
      notificationsRemoved,
      extensionRequestsRemoved: extensionsRemoved,
      keepaliveLogsRemoved,
      freedBytes,
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
