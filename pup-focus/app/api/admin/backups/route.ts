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
