import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { BackupSnapshotData } from "@/features/backup-archive/types/backup-archive.types";
import { logAudit, AUDIT_ACTION } from "@/lib/audit/log-audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
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
    academicYear: startsSchoolYear
      ? `${year}-${year + 1}`
      : `${year - 1}-${year}`,
    semester: startsSchoolYear ? "1st Semester" : "2nd Semester",
  };
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
    const academicYear =
      typeof body.academic_year === "string" && body.academic_year.trim() !== "all"
        ? body.academic_year.trim()
        : null;
    const semester =
      typeof body.semester === "string" && body.semester.trim() !== "all"
        ? body.semester.trim()
        : null;
    const facultyId =
      typeof body.faculty_id === "string" && body.faculty_id.trim() !== "all"
        ? body.faculty_id.trim()
        : null;
    const facultyName =
      typeof body.faculty_name === "string" && body.faculty_name.trim() !== "All Faculty Members"
        ? body.faculty_name.trim()
        : null;

    const supabase = getServiceRoleClient();

    // Map faculty_program_assignments for accurate term resolution
    const assignmentMap = new Map<string, { academicYear: string; semester: string }>();
    try {
      const { data: assignments } = await supabase
        .from("faculty_program_assignments")
        .select("id, academic_year, term");

      if (assignments) {
        for (const a of assignments) {
          if (a.id) {
            const semNorm = a.term?.toLowerCase().includes("2nd")
              ? "2nd Semester"
              : a.term?.toLowerCase().includes("summer")
              ? "Summer Term"
              : "1st Semester";
            assignmentMap.set(a.id, {
              academicYear: a.academic_year,
              semester: semNorm,
            });
          }
        }
      }
    } catch (err) {
      console.warn("faculty_program_assignments query note in backup create:", err);
    }

    const getTermInfo = (sub: {
      faculty_assignment_id?: string | null;
      submitted_at?: string | null;
      created_at?: string | null;
    }): { academicYear: string; semester: string } => {
      if (sub.faculty_assignment_id && assignmentMap.has(sub.faculty_assignment_id)) {
        return assignmentMap.get(sub.faculty_assignment_id)!;
      }
      return toAcademicYearAndSemester(sub.submitted_at || sub.created_at);
    };

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

    // 1. Identify Administrative Accounts and Faculty Accounts via Auth & User Roles
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
      console.warn("Error checking auth users in backup create route:", err);
    }

    // Identify profiles with faculty role in user_roles
    const facultyProfileIds = new Set<string>();
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
            if (ur.profile_id) facultyProfileIds.add(ur.profile_id);
          }
        }
      }
    } catch (err) {
      console.warn("Error querying faculty roles in backup create route:", err);
    }

    // Collect profiles strictly for faculty (no superadmin or admin)
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("*");

    const rawProfiles = profilesData || [];
    const facultyOnlyProfiles = rawProfiles.filter((u) => {
      const em = (u.email || "").toLowerCase().trim();
      // Exclude admin and superadmin accounts
      if (
        adminUserIds.has(u.id) ||
        (u.user_id && adminUserIds.has(u.user_id)) ||
        adminEmails.has(em) ||
        isAdministrativeAccount(u)
      ) {
        return false;
      }
      // Must be a recognized faculty member
      return (
        facultyProfileIds.has(u.id) ||
        (u.user_id && facultyProfileIds.has(u.user_id)) ||
        (u.user_id && facultyAuthUserIds.has(u.user_id)) ||
        facultyAuthUserIds.has(u.id)
      );
    });

    // Filter faculty profiles if scoped to a specific faculty member
    const filteredFacultyProfiles = facultyId
      ? facultyOnlyProfiles.filter((u) => u.id === facultyId || u.user_id === facultyId)
      : facultyOnlyProfiles;

    const filteredFacultyProfilesData = filteredFacultyProfiles;

    // 2. Collect Academic Terms
    const { data: termsData } = await supabase
      .from("academic_terms")
      .select("*");

    // 3. Collect Submissions (Faculty Compliance Submissions)
    const { data: submissionsData } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status, submitted_at, remarks, admin_remarks, is_archived, created_at, faculty_assignment_id");

    // 4. Collect Requirement Templates
    const { data: templatesData } = await supabase
      .from("requirement_templates")
      .select("*");

    // 5. Collect Audit Logs (Excluding admin account management events)
    let auditLogsData: unknown[] = [];
    try {
      const { data: logs } = await supabase
        .from("audit_logs")
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(500);

      if (logs) {
        auditLogsData = logs.filter((log: { action?: string; details?: Record<string, unknown>; actor_id?: string }) => {
          const action = String(log.action || "").toUpperCase();
          if (action.includes("ADMIN")) return false; // Exclude admin account logs
          if (facultyId) {
            const actorMatches = log.actor_id === facultyId;
            const targetMatches =
              log.details?.faculty_id === facultyId ||
              log.details?.faculty_profile_id === facultyId ||
              log.details?.user_id === facultyId;
            return actorMatches || targetMatches;
          }
          return true;
        });
      }
    } catch {
      // ignore
    }

    // Filter submissions according to selected scope
    const rawSubmissions = submissionsData || [];
    const filteredSubmissions = rawSubmissions.filter((sub) => {
      if (facultyId) {
        const matchesFaculty =
          sub.faculty_profile_id === facultyId ||
          (sub as Record<string, unknown>).user_id === facultyId;
        if (!matchesFaculty) return false;
      }

      if (academicYear || semester) {
        const termInfo = getTermInfo(sub);
        if (academicYear) {
          const ayMatch =
            termInfo.academicYear.toLowerCase() === academicYear.toLowerCase() ||
            termInfo.academicYear.replace(/[^0-9]/g, "") === academicYear.replace(/[^0-9]/g, "");
          if (!ayMatch) return false;
        }
        if (semester) {
          const semMatch =
            termInfo.semester.toLowerCase().includes(semester.toLowerCase()) ||
            semester.toLowerCase().includes(termInfo.semester.toLowerCase());
          if (!semMatch) return false;
        }
      }

      return true;
    });

    // Filter academic terms according to selected scope
    const rawTerms = termsData || [];
    const filteredTerms = rawTerms.filter((term) => {
      if (academicYear) {
        const ayMatch =
          term.academic_year?.toLowerCase() === academicYear.toLowerCase() ||
          term.academic_year?.replace(/[^0-9]/g, "") === academicYear.replace(/[^0-9]/g, "");
        if (!ayMatch) return false;
      }
      if (semester) {
        const semMatch =
          term.semester?.toLowerCase().includes(semester.toLowerCase()) ||
          semester.toLowerCase().includes(term.semester?.toLowerCase() || "");
        if (!semMatch) return false;
      }
      return true;
    });

    const users = filteredFacultyProfiles;
    const terms = filteredTerms.length > 0 ? filteredTerms : rawTerms;
    const submissions = filteredSubmissions;
    const templates = templatesData || [];
    const auditLogs = auditLogsData;

    const totalRecords =
      users.length +
      terms.length +
      submissions.length +
      templates.length +
      auditLogs.length;

    const scopeMetadata = {
      academic_year: academicYear,
      semester: semester,
      faculty_id: facultyId,
      faculty_name: facultyName,
    };

    const snapshotPayload: BackupSnapshotData = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      generated_by: user.email || user.id,
      scope: scopeMetadata,
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
        faculty_profiles: filteredFacultyProfilesData,
        academic_terms: terms,
        submissions,
        requirement_templates: templates,
        audit_logs: auditLogs,
      },
    };

    const jsonString = JSON.stringify(snapshotPayload, null, 2);
    const fileSizeKb = Math.max(1, Math.round(Buffer.byteLength(jsonString, "utf8") / 1024));

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const scopeSegments: string[] = [];
    if (academicYear) scopeSegments.push(academicYear.replace(/[^a-zA-Z0-9]/g, "_"));
    if (semester) scopeSegments.push(semester.replace(/[^a-zA-Z0-9]/g, "_"));
    if (facultyName) {
      scopeSegments.push(facultyName.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 20));
    } else if (facultyId) {
      scopeSegments.push(`Faculty_${facultyId.slice(0, 8)}`);
    }

    const defaultName = scopeSegments.length > 0
      ? `Backup_${scopeSegments.join("_")}_${dateStr}`
      : `Full_System_Backup_${dateStr}`;

    const backupName = customName || defaultName;

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
        academic_year: academicYear,
        semester: semester,
        faculty_id: facultyId,
        faculty_name: facultyName,
        scope: scopeMetadata,
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

    // Audit log: backup created
    await logAudit({
      actorId: user.id,
      action: AUDIT_ACTION.BACKUP_CREATE,
      entityType: "system_backup",
      entityId: backupRecord.id,
      metadata: {
        backup_name: backupName,
        scope: scopeMetadata,
        total_records: totalRecords,
        users_count: users.length,
        submissions_count: submissions.length,
        file_size_kb: fileSizeKb,
      },
    });

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
