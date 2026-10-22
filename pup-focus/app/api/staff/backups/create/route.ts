import { NextRequest, NextResponse } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import type { BackupSnapshotData } from "@/features/backup-archive/types/backup-archive.types";
import { logAudit, AUDIT_ACTION } from "@/lib/audit/log-audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAdminRole(role: string | undefined) {
  return role === ROLE.STAFF || role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN || role === "staff";
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

    // All backups strictly capture all genuine faculty members
    const filteredFacultyProfiles = facultyOnlyProfiles;
    const filteredFacultyProfilesData = filteredFacultyProfiles;

    // Resolve target Academic Year & Semester (fallback to active Current term if not explicitly provided)
    let targetAy = academicYear;
    let targetSem = semester;

    const { data: termsData } = await supabase
      .from("academic_terms")
      .select("*");

    if (!targetAy || !targetSem) {
      const currentTermRow = (termsData || []).find((t) => t.status === "Current");
      if (currentTermRow) {
        if (!targetAy) targetAy = currentTermRow.academic_year;
        if (!targetSem) targetSem = currentTermRow.semester;
      }
    }

    // 2. Collect Submissions including storage paths, file names, and mime types
    const { data: submissionsData } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status, submitted_at, remarks, admin_remarks, is_archived, created_at, faculty_assignment_id, storage_path, file_name, mime_type, size_bytes");

    // 3. Fallback Document Versions if file columns are in legacy table
    const subIds = (submissionsData || []).map((s) => s.id);
    const docVersionsMap = new Map<string, { storage_path?: string; file_name?: string; mime_type?: string; size_bytes?: number }>();
    if (subIds.length > 0) {
      try {
        const { data: docVersions } = await supabase
          .from("document_versions")
          .select("submission_id, storage_path, file_name, mime_type, size_bytes")
          .in("submission_id", subIds);
        if (docVersions) {
          for (const dv of docVersions) {
            if (dv.submission_id && !docVersionsMap.has(dv.submission_id)) {
              docVersionsMap.set(dv.submission_id, dv);
            }
          }
        }
      } catch {
        // ignore
      }
    }

    // 4. Requirement Templates for human-readable requirement titles
    const { data: templatesData } = await supabase
      .from("requirement_templates")
      .select("code, title, name");
    const templateTitleMap = new Map<string, string>();
    for (const t of templatesData || []) {
      if (t.code) templateTitleMap.set(t.code, t.title || t.name || t.code);
    }

    // Helper: Determine exact file type / extension
    function extractFileType(
      fileName?: string | null,
      mimeType?: string | null,
      storagePath?: string | null,
    ): string {
      const pathOrName = (fileName || storagePath || "").trim();
      const extMatch = pathOrName.match(/\.([a-zA-Z0-9]+)$/);
      if (extMatch && extMatch[1]) {
        return extMatch[1].toUpperCase();
      }
      if (mimeType) {
        const m = mimeType.toLowerCase();
        if (m.includes("pdf")) return "PDF";
        if (m.includes("word") || m.includes("document") || m.includes("docx") || m.includes("msword")) return "DOCX";
        if (m.includes("sheet") || m.includes("excel") || m.includes("xlsx") || m.includes("csv")) return "XLSX";
        if (m.includes("image/png") || m.includes("png")) return "PNG";
        if (m.includes("image/jpeg") || m.includes("jpeg") || m.includes("jpg")) return "JPG";
        if (m.includes("zip") || m.includes("compressed")) return "ZIP";
      }
      return "PDF";
    }

    // Filter submissions strictly to current target Academic Year and Semester
    const rawSubmissions = submissionsData || [];
    const termSubmissions = rawSubmissions.filter((sub) => {
      const termInfo = getTermInfo(sub);
      if (targetAy) {
        const ayMatch =
          termInfo.academicYear.toLowerCase() === targetAy.toLowerCase() ||
          termInfo.academicYear.replace(/[^0-9]/g, "") === targetAy.replace(/[^0-9]/g, "");
        if (!ayMatch) return false;
      }
      if (targetSem) {
        const semMatch =
          termInfo.semester.toLowerCase().includes(targetSem.toLowerCase()) ||
          targetSem.toLowerCase().includes(termInfo.semester.toLowerCase());
        if (!semMatch) return false;
      }
      return true;
    });

    // Group submissions by faculty profile ID
    const submissionsByFaculty = new Map<string, any[]>();
    for (const sub of termSubmissions) {
      const fId = sub.faculty_profile_id;
      if (!fId) continue;
      const list = submissionsByFaculty.get(fId) || [];
      list.push(sub);
      submissionsByFaculty.set(fId, list);
    }

    // Build the clean list of all faculty and their submitted requirements with file types
    const fileTypesSummary: Record<string, number> = {};
    let totalSubmissionsCount = 0;

    const facultyComplianceRoster = filteredFacultyProfiles.map((faculty) => {
      const subs =
        submissionsByFaculty.get(faculty.id) ||
        (faculty.user_id ? submissionsByFaculty.get(faculty.user_id) : []) ||
        [];

      const submittedRequirements = subs.map((s) => {
        const dv = docVersionsMap.get(s.id);
        const storagePath = s.storage_path || dv?.storage_path || null;
        const fileName = s.file_name || dv?.file_name || (storagePath ? storagePath.split("/").pop() : null);
        const mimeType = s.mime_type || dv?.mime_type || (fileName?.endsWith(".pdf") ? "application/pdf" : null);
        const sizeBytes = s.size_bytes || dv?.size_bytes || null;
        const fileType = extractFileType(fileName, mimeType, storagePath);

        fileTypesSummary[fileType] = (fileTypesSummary[fileType] || 0) + 1;
        totalSubmissionsCount++;

        return {
          submission_id: s.id,
          requirement_code: s.requirement_code,
          requirement_title: templateTitleMap.get(s.requirement_code) || s.requirement_code,
          status: s.status || "Submitted",
          submitted_at: s.submitted_at || s.created_at,
          file: {
            file_name: fileName || `${s.requirement_code}_Document.${fileType.toLowerCase()}`,
            file_type: fileType,
            mime_type: mimeType || "application/octet-stream",
            size_bytes: sizeBytes,
            storage_path: storagePath,
          },
          remarks: s.remarks || null,
          admin_remarks: s.admin_remarks || null,
        };
      });

      return {
        faculty_id: faculty.id,
        user_id: faculty.user_id || null,
        name: faculty.name || faculty.full_name || "Faculty Member",
        email: faculty.email || null,
        department: faculty.department || null,
        total_submitted_requirements: submittedRequirements.length,
        requirements: submittedRequirements,
      };
    });

    const totalRecords = totalSubmissionsCount;

    const scopeMetadata = {
      academic_year: targetAy,
      semester: targetSem,
      faculty_id: "all",
      faculty_name: "All Faculty Members",
    };

    // Clean, structured snapshot capturing ONLY all faculty and their submitted requirements with file types
    const snapshotPayload = {
      version: "2.0",
      backup_type: "faculty_semester_compliance_backup",
      academic_year: targetAy,
      semester: targetSem,
      exported_at: new Date().toISOString(),
      generated_by: user.email || user.id,
      scope: scopeMetadata,
      summary: {
        total_records: totalRecords,
        total_faculty: facultyComplianceRoster.length,
        total_submissions: totalSubmissionsCount,
        file_types_summary: fileTypesSummary,
        users_count: facultyComplianceRoster.length,
        submissions_count: totalSubmissionsCount,
      },
      faculty_roster: facultyComplianceRoster,
      data: {
        faculty_list: facultyComplianceRoster,
        users: facultyComplianceRoster.map((f) => ({
          id: f.faculty_id,
          name: f.name,
          email: f.email,
          department: f.department,
        })),
        submissions: termSubmissions,
      },
    };

    const jsonString = JSON.stringify(snapshotPayload, null, 2);
    const fileSizeKb = Math.max(1, Math.round(Buffer.byteLength(jsonString, "utf8") / 1024));

    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const scopeSegments: string[] = [];
    if (targetAy) scopeSegments.push(targetAy.replace(/[^a-zA-Z0-9]/g, "_"));
    if (targetSem) scopeSegments.push(targetSem.replace(/[^a-zA-Z0-9]/g, "_"));

    const defaultName = scopeSegments.length > 0
      ? `Backup_${scopeSegments.join("_")}_All_Faculty_${dateStr}`
      : `Faculty_Backup_${dateStr}`;

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
      academic_year: targetAy || null,
      total_records: totalRecords,
      file_size_kb: fileSizeKb,
      status: "completed" as const,
      created_by: creatorProfileId,
      metadata: {
        academic_year: targetAy,
        semester: targetSem,
        faculty_id: "all",
        faculty_name: "All Faculty Members",
        scope: scopeMetadata,
        users_count: facultyComplianceRoster.length,
        terms_count: 1,
        submissions_count: totalSubmissionsCount,
        file_types_summary: fileTypesSummary,
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
        users_count: facultyComplianceRoster.length,
        submissions_count: totalSubmissionsCount,
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
