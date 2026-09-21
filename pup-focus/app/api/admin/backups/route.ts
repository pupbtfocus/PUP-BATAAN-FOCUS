import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type {
  SystemBackup,
  ArchivedTermSummary,
  AvailableAcademicTerm,
  BackupStats,
} from "@/features/backup-archive/types/backup-archive.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
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
      updated_at?: string;
    }> = [];

    try {
      const { data, error } = await supabase
        .from("academic_terms")
        .select("academic_year, semester, status, is_archived, updated_at")
        .order("created_at", { ascending: false });

      if (!error && data) {
        termsRows = data;
      }
    } catch (err) {
      console.warn("Error querying academic_terms:", err);
    }

    // If no terms in DB, fallback to standard defaults
    if (termsRows.length === 0) {
      termsRows = [
        { academic_year: "2025-2026", semester: "2nd Semester", status: "Current", is_archived: false },
        { academic_year: "2025-2026", semester: "1st Semester", status: "Archived", is_archived: true },
        { academic_year: "2024-2025", semester: "2nd Semester", status: "Archived", is_archived: true },
        { academic_year: "2024-2025", semester: "1st Semester", status: "Archived", is_archived: true },
      ];
    }

    // 3. Fetch submissions counts per term
    let submissionsList: Array<{
      id: string;
      academic_year?: string | null;
      semester?: string | null;
      status?: string | null;
      is_archived?: boolean | null;
      created_at?: string | null;
    }> = [];

    try {
      const { data: subData, error: subError } = await supabase
        .from("submissions")
        .select("id, status, is_archived, created_at, faculty_assignment_id");

      if (!subError && subData) {
        submissionsList = subData as typeof submissionsList;
      }
    } catch (err) {
      console.warn("Error querying submissions for archive summary:", err);
    }

    // Build available and archived terms
    const availableTerms: AvailableAcademicTerm[] = [];
    const archivedTerms: ArchivedTermSummary[] = [];

    for (const term of termsRows) {
      const isArchived = Boolean(term.is_archived) || term.status === "Archived";
      
      const termItem: AvailableAcademicTerm = {
        academic_year: term.academic_year,
        semester: term.semester,
        status: term.status,
        is_archived: isArchived,
        total_submissions: 0,
      };

      availableTerms.push(termItem);

      if (isArchived) {
        archivedTerms.push({
          academic_year: term.academic_year,
          semester: term.semester,
          status: "Archived",
          is_archived: true,
          total_submissions: 0,
          validated_submissions: 0,
          archived_at: term.updated_at || null,
        });
      }
    }

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
        const r = ((u.user_metadata?.role as string) || (u.app_metadata?.role as string) || "").toLowerCase().trim();
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

    if (academicYears.length === 0) {
      academicYears.push("2026-2027", "2025-2026", "2024-2025");
    }

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
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

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

    return NextResponse.json({ success: true, message: "Backup log deleted." });
  } catch (error) {
    console.error("DELETE /api/admin/backups error:", error);
    return NextResponse.json(
      { error: "Failed to delete backup log" },
      { status: 500 }
    );
  }
}
