import { NextRequest, NextResponse } from "next/server";
import { ROLE, resolveTrustedUserRole } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit, AUDIT_ACTION } from "@/lib/audit/log-audit";
import type {
  SystemBackup,
  ArchivedTermSummary,
  AvailableAcademicTerm,
  BackupStats,
} from "@/features/backup-archive/types/backup-archive.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.STAFF || role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN || role === "staff";
}

export async function GET(request: NextRequest) {
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

    const supabase = getServiceRoleClient();

    // 1. Fetch system backups
    let backups: SystemBackup[] = [];
    try {
      const { data: backupRows, error: backupError } = await supabase
        .from("system_backups")
        .select("*")
        .order("created_at", { ascending: false });

      if (!backupError && backupRows) {
        backups = backupRows as SystemBackup[];
      }
    } catch (err) {
      console.warn("Error querying system_backups table:", err);
    }

    // 2. Fetch academic terms
    let termsRows: Array<{
      academic_year: string;
      semester: string;
      status: string;
      is_archived?: boolean;
      created_at?: string;
      updated_at?: string;
    }> = [];

    try {
      const { data, error } = await supabase
        .from("academic_terms")
        .select("academic_year, semester, status, is_archived, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        termsRows = data;
      } else if (error) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("academic_terms")
          .select("academic_year, semester, status")
          .order("academic_year", { ascending: false });

        if (!fallbackError && fallbackData) {
          termsRows = fallbackData.map((row) => ({
            ...row,
            is_archived: row.status === "Archived",
          }));
        }
      }
    } catch (err) {
      console.warn("Error querying academic_terms:", err);
    }

    // 3. Fetch submissions & assignment mappings to detect active vs cleaned Storage files per term
    let submissionsList: Array<{
      id: string;
      status?: string | null;
      is_archived?: boolean | null;
      created_at?: string | null;
      submitted_at?: string | null;
      faculty_assignment_id?: string | null;
      class_id?: string | null;
      storage_path?: string | null;
    }> = [];

    const normAy = (v?: string | null) =>
      (v || "").toLowerCase().trim().replace(/^s\.?y\.?\s*/i, "").replace(/^a\.?y\.?\s*/i, "").replace(/[^0-9]/g, "");
    const normSem = (v?: string | null) => {
      const s = (v || "").toLowerCase().trim();
      if (s.includes("2nd") || s.includes("second")) return "2nd semester";
      if (s.includes("summer")) return "summer semester";
      if (s.includes("1st") || s.includes("first")) return "1st semester";
      return s;
    };
    const inferTerm = (dateInput?: string | null) => {
      const src = dateInput ? new Date(dateInput) : new Date();
      const d = Number.isNaN(src.getTime()) ? new Date() : src;
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const first = m >= 6;
      return {
        ay: first ? `${y}-${y + 1}` : `${y - 1}-${y}`,
        sem: first ? "1st Semester" : "2nd Semester",
      };
    };

    const assignmentTermMap = new Map<string, { ay: string; sem: string }>();
    const classTermMap = new Map<string, { ay: string; sem: string }>();
    const submissionTermMap = new Map<string, string>();
    const termsWithActiveFiles = new Set<string>();
    const termsWithCleanedFiles = new Set<string>();
    const termsWithCleanableLogs = new Set<string>();
    const termSubmissionCounts = new Map<string, number>();
    let storageHasAnyFiles = false;

    try {
      const orderedTermsAsc = [...termsRows].sort((a, b) => {
        const aMs = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bMs = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aMs - bMs;
      });
      const isSingleTermSystem = orderedTermsAsc.length <= 1;

      const resolveDateTermKey = (iso?: string | null): string | null => {
        if (orderedTermsAsc.length === 0) {
          const inferred = inferTerm(iso);
          return `${normAy(inferred.ay)}::${normSem(inferred.sem)}`;
        }
        if (isSingleTermSystem) {
          const t = orderedTermsAsc[0];
          return `${normAy(t.academic_year)}::${normSem(t.semester)}`;
        }
        if (!iso) return null;
        const ms = new Date(iso).getTime();
        if (Number.isNaN(ms)) return null;
        for (let i = orderedTermsAsc.length - 1; i >= 0; i--) {
          const startIso = i > 0 ? orderedTermsAsc[i].created_at : null;
          const endIso =
            i < orderedTermsAsc.length - 1
              ? orderedTermsAsc[i + 1].created_at
              : null;
          if (startIso && ms < new Date(startIso).getTime()) continue;
          if (endIso && ms >= new Date(endIso).getTime()) continue;
          return `${normAy(orderedTermsAsc[i].academic_year)}::${normSem(orderedTermsAsc[i].semester)}`;
        }
        const inferred = inferTerm(iso);
        return `${normAy(inferred.ay)}::${normSem(inferred.sem)}`;
      };

      const [assignRes, classRes, subPrimary, txRes, notifRes, extRes] =
        await Promise.all([
          supabase
            .from("faculty_program_assignments")
            .select("id, academic_year, term"),
          supabase
            .from("faculty_classes")
            .select("id, academic_year, semester"),
          supabase
            .from("submissions")
            .select("id, status, created_at, submitted_at, faculty_assignment_id, class_id, storage_path"),
          supabase
            .from("transaction_logs")
            .select("id, action, entity_id, metadata, created_at"),
          supabase
            .from("notifications")
            .select("id, created_at"),
          supabase
            .from("extension_requests")
            .select("id, academic_year, semester, created_at"),
        ]);

      for (const a of assignRes.data ?? []) {
        if (a.id && a.academic_year) {
          assignmentTermMap.set(a.id, { ay: a.academic_year, sem: a.term || "1st Semester" });
        }
      }
      for (const c of classRes.data ?? []) {
        if (c.id && c.academic_year) {
          classTermMap.set(c.id, { ay: c.academic_year, sem: c.semester || "1st Semester" });
        }
      }

      if (!subPrimary.error && subPrimary.data) {
        submissionsList = subPrimary.data as typeof submissionsList;
      } else {
        const subWithStorage = await supabase
          .from("submissions")
          .select("id, status, created_at, submitted_at, faculty_assignment_id, storage_path");
        if (!subWithStorage.error && subWithStorage.data) {
          submissionsList = subWithStorage.data as typeof submissionsList;
        } else {
          const subFallback = await supabase
            .from("submissions")
            .select("id, status, created_at, submitted_at, faculty_assignment_id");
          if (!subFallback.error && subFallback.data) {
            submissionsList = subFallback.data as typeof submissionsList;
          }
        }
      }

      // Check whether submission Storage buckets actually hold any files
      try {
        const { data: buckets } = await supabase.storage.listBuckets();
        const subBuckets = (buckets ?? [])
          .map((b) => b.name)
          .filter((n) => n && n.toLowerCase() !== "avatars");
        for (const bName of subBuckets.length > 0 ? subBuckets : ["faculty-submissions", "submissions"]) {
          const { data: rootList } = await supabase.storage.from(bName).list("", { limit: 5 });
          if (Array.isArray(rootList) && rootList.some((item) => item.name && item.name !== ".emptyFolderPlaceholder")) {
            storageHasAnyFiles = true;
            break;
          }
        }
      } catch {
        storageHasAnyFiles = true;
      }

      for (const sub of submissionsList) {
        const term =
          (sub.faculty_assignment_id && assignmentTermMap.get(sub.faculty_assignment_id)) ||
          (sub.class_id && classTermMap.get(sub.class_id)) ||
          inferTerm(sub.submitted_at || sub.created_at);
        const key = `${normAy(term.ay)}::${normSem(term.sem)}`;
        submissionTermMap.set(sub.id, key);
        termSubmissionCounts.set(key, (termSubmissionCounts.get(key) ?? 0) + 1);
        if (sub.storage_path?.startsWith("__cleaned__") || !storageHasAnyFiles) {
          termsWithCleanedFiles.add(key);
        } else if (
          sub.storage_path ||
          (sub.status &&
            sub.status !== "missing" &&
            sub.status !== "pending" &&
            sub.status !== "exempted")
        ) {
          termsWithActiveFiles.add(key);
        }
      }

      // Track whether any cleanable logs, notifications, or extension requests remain per term
      type TxLogCheckRow = {
        id: string;
        action?: string | null;
        entity_id?: string | null;
        metadata?: Record<string, unknown> | null;
        created_at?: string | null;
      };
      let txRowsForCheck: TxLogCheckRow[] | null = txRes.error
        ? null
        : ((txRes.data ?? []) as TxLogCheckRow[]);
      if (!txRowsForCheck) {
        const auditFallback = await supabase
          .from("audit_logs")
          .select("id, action, entity_id, metadata, created_at");
        txRowsForCheck = (auditFallback.data ?? []) as TxLogCheckRow[];
      }
      for (const row of txRowsForCheck ?? []) {
        if (row.action === "backup.clean_term") continue;
        const meta = row.metadata ?? {};
        const metaAy = meta.academic_year ? normAy(String(meta.academic_year)) : "";
        const metaSem = meta.semester ? normSem(String(meta.semester)) : "";
        let key: string | null = null;
        if (metaAy && metaSem) {
          key = `${metaAy}::${metaSem}`;
        } else if (row.entity_id && row.entity_id.includes("::")) {
          const [eAy, eSem] = row.entity_id.split("::");
          key = `${normAy(eAy)}::${normSem(eSem)}`;
        } else if (row.entity_id && submissionTermMap.has(row.entity_id)) {
          key = submissionTermMap.get(row.entity_id) ?? null;
        } else if (row.entity_id && classTermMap.has(row.entity_id)) {
          const c = classTermMap.get(row.entity_id)!;
          key = `${normAy(c.ay)}::${normSem(c.sem)}`;
        } else {
          key = resolveDateTermKey(row.created_at);
        }
        if (key) termsWithCleanableLogs.add(key);
      }

      if (!notifRes.error && Array.isArray(notifRes.data)) {
        for (const n of notifRes.data) {
          const key = resolveDateTermKey(n.created_at);
          if (key) termsWithCleanableLogs.add(key);
        }
      }

      if (!extRes.error && Array.isArray(extRes.data)) {
        for (const r of extRes.data) {
          const rAy = normAy(r.academic_year);
          const rSem = normSem(r.semester);
          const key =
            rAy && rSem
              ? `${rAy}::${rSem}`
              : resolveDateTermKey(r.created_at);
          if (key) termsWithCleanableLogs.add(key);
        }
      }
    } catch (err) {
      console.warn("Error querying submissions for archive summary:", err);
    }

    // Build available and archived terms
    const availableTerms: AvailableAcademicTerm[] = [];
    const archivedTerms: ArchivedTermSummary[] = [];

    for (const term of termsRows) {
      const isArchived = Boolean(term.is_archived) || term.status === "Archived";
      const termKey = `${normAy(term.academic_year)}::${normSem(term.semester)}`;
      const subCount = termSubmissionCounts.get(termKey) ?? 0;
      const hasDownloadableFiles = termsWithActiveFiles.has(termKey);
      const isFilesCleaned = !hasDownloadableFiles && termsWithCleanedFiles.has(termKey);
      const hasCleanableData = hasDownloadableFiles;

      const termItem: AvailableAcademicTerm = {
        academic_year: term.academic_year,
        semester: term.semester,
        status: term.status,
        is_archived: isArchived,
        total_submissions: subCount,
        has_downloadable_files: hasDownloadableFiles,
        is_files_cleaned: isFilesCleaned,
        has_cleanable_data: hasCleanableData,
      };

      availableTerms.push(termItem);

      if (isArchived) {
        archivedTerms.push({
          academic_year: term.academic_year,
          semester: term.semester,
          status: "Archived",
          is_archived: true,
          total_submissions: subCount,
          validated_submissions: 0,
          archived_at: term.updated_at || null,
          has_downloadable_files: hasDownloadableFiles,
          is_files_cleaned: isFilesCleaned,
          has_cleanable_data: hasCleanableData,
        });
      }
    }

    backups = backups.map((bk) => {
      const meta = (bk.metadata ?? {}) as Record<string, any>;
      const scope = (typeof meta.scope === "object" && meta.scope !== null ? meta.scope : {}) as Record<string, any>;
      const bAy = scope.academic_year || bk.academic_year || meta.academic_year || null;
      const bSem = scope.semester || meta.semester || null;

      let hasFiles = termsWithActiveFiles.size > 0;
      let isCleaned = !hasFiles && termsWithCleanedFiles.size > 0;
      if (bAy && bSem) {
        const key = `${normAy(String(bAy))}::${normSem(String(bSem))}`;
        hasFiles = termsWithActiveFiles.has(key);
        isCleaned = !hasFiles && termsWithCleanedFiles.has(key);
      } else if (bAy) {
        const ayPrefix = `${normAy(String(bAy))}::`;
        hasFiles = Array.from(termsWithActiveFiles).some((k) => k.startsWith(ayPrefix));
        isCleaned = !hasFiles && Array.from(termsWithCleanedFiles).some((k) => k.startsWith(ayPrefix));
      }

      return {
        ...bk,
        has_downloadable_files: hasFiles,
        is_files_cleaned: isCleaned,
      };
    });

    // 4. Fetch faculty list for scoped backups (Strictly faculty only - exclude admin & superadmin)
    const facultyList: Array<{
      id: string;
      user_id?: string | null;
      name: string;
      email?: string | null;
      department?: string | null;
    }> = [];
    const seenFacultyIds = new Set<string>();

    function isAdministrativeAccount(account: {
      id?: string | null;
      user_id?: string | null;
      name?: string | null;
      full_name?: string | null;
      email?: string | null;
    }): boolean {
      const email = (account.email || "").toLowerCase().trim();
      const name = (account.name || account.full_name || "").toLowerCase().trim();

      if (
        email === "pupbataanfocus.superadmin@gmail.com" ||
        email === "preview@pupfocus.dev" ||
        email === "christianjaycmandani@iskolarngbayan.pup.edu.ph" ||
        email.includes("superadmin") ||
        email.includes("admin@") ||
        email.endsWith("@pupfocus.dev")
      ) {
        return true;
      }

      if (
        name.includes("super admin") ||
        name.includes("developer preview") ||
        name === "pup focus super admin" ||
        name.includes("system administrator")
      ) {
        return true;
      }

      return false;
    }

    // 4a. Query auth users to detect authoritative administrative accounts and faculty accounts
    const adminUserIds = new Set<string>();
    const adminEmails = new Set<string>();
    const facultyAuthUserIds = new Set<string>();

    try {
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of authData?.users || []) {
        const r = (resolveTrustedUserRole(u) ?? "").toLowerCase().trim();
        const em = (u.email || "").toLowerCase().trim();

        if (
          r === "admin" ||
          r === "super_admin" ||
          r === "superadmin" ||
          isAdministrativeAccount(u)
        ) {
          adminUserIds.add(u.id);
          if (em) adminEmails.add(em);
        } else if (r === "faculty") {
          facultyAuthUserIds.add(u.id);
        }
      }
    } catch (err) {
      console.warn("Error listing auth users for backup role check:", err);
    }

    // 4b. Identify profiles with faculty role in user_roles
    const verifiedFacultyProfileIds = new Set<string>();
    try {
      const { data: facultyRole } = await supabase
        .from("roles")
        .select("id")
        .eq("code", "faculty")
        .maybeSingle();

      if (facultyRole?.id) {
        const { data: fUserRoles } = await supabase
          .from("user_roles")
          .select("profile_id")
          .eq("role_id", facultyRole.id);

        if (fUserRoles) {
          for (const ur of fUserRoles) {
            if (ur.profile_id) verifiedFacultyProfileIds.add(ur.profile_id);
          }
        }
      }
    } catch (err) {
      console.warn("Error querying faculty roles in backups route:", err);
    }

    // 4c. Query profiles and filter strictly for faculty members
    try {
      const { data: profs, error: profsErr } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email")
        .order("full_name", { ascending: true });

      if (!profsErr && profs && Array.isArray(profs)) {
        for (const p of profs) {
          const email = (p.email || "").toLowerCase().trim();

          // Exclude any administrative account
          if (
            adminUserIds.has(p.id) ||
            (p.user_id && adminUserIds.has(p.user_id)) ||
            adminEmails.has(email) ||
            isAdministrativeAccount(p)
          ) {
            continue;
          }

          // Must be recognized as faculty either via user_roles or auth metadata
          const isFaculty =
            verifiedFacultyProfileIds.has(p.id) ||
            (p.user_id && verifiedFacultyProfileIds.has(p.user_id)) ||
            (p.user_id && facultyAuthUserIds.has(p.user_id)) ||
            facultyAuthUserIds.has(p.id);

          if (!isFaculty) {
            continue;
          }

          const name = p.full_name?.trim() || p.email?.split("@")[0] || "Faculty Member";
          const key = p.id || p.user_id;

          if (key && !seenFacultyIds.has(key)) {
            seenFacultyIds.add(key);
            facultyList.push({
              id: p.id,
              user_id: p.user_id || null,
              name,
              email: p.email || null,
              department: null,
            });
          }
        }
      }
    } catch (err) {
      console.warn("Error querying profiles in backups route:", err);
    }

    facultyList.sort((a, b) => a.name.localeCompare(b.name));

    // 5. Extract unique Academic Years
    const academicYears = Array.from(
      new Set(
        termsRows
          .map((t) => t.academic_year)
          .filter((ay): ay is string => Boolean(ay && ay.trim()))
      )
    ).sort((a, b) => b.localeCompare(a));

    // Compute stats
    const uniqueArchivedAYs = new Set(archivedTerms.map((t) => t.academic_year));
    const lastBackup = backups.length > 0 ? backups[0].created_at : null;

    const stats: BackupStats = {
      total_backups: backups.length,
      archived_academic_years: uniqueArchivedAYs.size,
      last_backup_date: lastBackup,
      total_archived_documents: submissionsList.filter((s) => s.is_archived).length,
    };

    return NextResponse.json({
      backups,
      archivedTerms,
      availableTerms,
      academicYears,
      facultyList,
      stats,
    });
  } catch (error) {
    console.error("GET /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Failed to fetch backup & archiving status" },
      { status: 500 }
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

    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Backup ID is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const { error: deleteError } = await supabase
      .from("system_backups")
      .delete()
      .eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    // Audit log: backup deleted
    await logAudit({
      actorId: user.id,
      action: AUDIT_ACTION.BACKUP_DELETE,
      entityType: "system_backup",
      entityId: id,
      metadata: { deleted_backup_id: id },
    });

    return NextResponse.json({ success: true, message: "Backup log deleted." });
  } catch (error) {
    console.error("DELETE /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Failed to delete backup log" },
      { status: 500 }
    );
  }
}
