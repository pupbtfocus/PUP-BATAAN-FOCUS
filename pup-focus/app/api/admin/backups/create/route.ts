import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { BackupSnapshotData } from "@/features/backup-archive/types/backup-archive.types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
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

    const body = await request.json().catch(() => ({}));
    const customName = typeof body.name === "string" ? body.name.trim() : null;
    const academicYear = typeof body.academic_year === "string" ? body.academic_year.trim() : null;

    const supabase = getServiceRoleClient();

    // 1. Collect Users
    const { data: usersData } = await supabase
      .from("profiles")
      .select("id, full_name, first_name, last_name, email, role, is_active, department, created_at");

    // 2. Collect Academic Terms
    const { data: termsData } = await supabase
      .from("academic_terms")
      .select("*");

    // 3. Collect Submissions
    const { data: submissionsData } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status, submitted_at, remarks, admin_remarks, is_archived, created_at");

    // 4. Collect Requirement Templates
    const { data: templatesData } = await supabase
      .from("requirement_templates")
      .select("*");

    // 5. Collect Audit Logs
    let auditLogsData: unknown[] = [];
    try {
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(500);

      if (logs) {
        auditLogsData = logs;
      }
    } catch {
      // ignore
    }

    const users = usersData || [];
    const terms = termsData || [];
    const submissions = submissionsData || [];
    const templates = templatesData || [];
    const auditLogs = auditLogsData || [];

    const totalRecords =
      users.length +
      terms.length +
      submissions.length +
      templates.length +
      auditLogs.length;

    const snapshotPayload: BackupSnapshotData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      generated_by: user.email || user.id,
      summary: {
        total_records: totalRecords,
        users_count: users.length,
        academic_terms_count: terms.length,
        submissions_count: submissions.length,
        requirement_templates_count: templates.length,
        audit_logs_count: auditLogs.length,
      },
      data: {
        users,
        academic_terms: terms,
        submissions,
        requirement_templates: templates,
        audit_logs: auditLogs,
      },
    };

    const jsonString = JSON.stringify(snapshotPayload, null, 2);
    const fileSizeKb = Math.max(1, Math.round(Buffer.byteLength(jsonString, "utf8") / 1024));

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName =
      customName ||
      (academicYear
        ? `Backup_${academicYear.replace(/[^a-zA-Z0-9]/g, "_")}_${dateStr}`
        : `Full_System_Backup_${dateStr}`);

    // Resolve profile ID for created_by
    let creatorProfileId: string | null = null;
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (prof?.id) {
        creatorProfileId = prof.id;
      }
    } catch {
      // ignore
    }

    // Insert backup history record to database before responding
    let backupRecord = null;
    let insertErrorMessage: string | null = null;

    const backupPayload = {
      backup_name: backupName,
      academic_year: academicYear || null,
      total_records: totalRecords,
      file_size_kb: fileSizeKb,
      status: "completed" as const,
      created_by: creatorProfileId,
      metadata: {
        users_count: users.length,
        terms_count: terms.length,
        submissions_count: submissions.length,
        templates_count: templates.length,
        audit_logs_count: auditLogs.length,
        snapshot: snapshotPayload,
      },
    };

    const { data: inserted, error: insertError } = await supabase
      .from("system_backups")
      .insert(backupPayload)
      .select()
      .single();

    if (insertError) {
      console.error("Failed to insert system_backup row:", insertError);
      insertErrorMessage = insertError.message;

      // Retry once without created_by in case of FK constraint mismatch
      if (creatorProfileId) {
        const { data: retryData, error: retryError } = await supabase
          .from("system_backups")
          .insert({
            ...backupPayload,
            created_by: null,
          })
          .select()
          .single();

        if (!retryError && retryData) {
          backupRecord = retryData;
          insertErrorMessage = null;
        } else if (retryError) {
          insertErrorMessage = retryError.message;
        }
      }
    } else if (inserted) {
      backupRecord = inserted;
    }

    if (!backupRecord) {
      console.error("system_backups database error:", insertErrorMessage);
      return NextResponse.json(
        {
          error:
            "Failed to save backup history to database. Please ensure SQL migration 0021 was executed.",
          details: insertErrorMessage,
          snapshot: snapshotPayload,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Backup generated and saved successfully!",
      backup: backupRecord,
      snapshot: snapshotPayload,
    });
  } catch (error) {
    console.error("POST /api/admin/backups/create error:", error);
    return NextResponse.json(
      { error: "Failed to generate system backup snapshot" },
      { status: 500 }
    );
  }
}
