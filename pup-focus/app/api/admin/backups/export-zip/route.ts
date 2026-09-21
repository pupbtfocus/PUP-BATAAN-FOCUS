import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import { REQUIREMENT_LABEL, type RequirementCode } from "@/config/compliance";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logAudit, AUDIT_ACTION } from "@/lib/audit/log-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface ProfileRow {
  id: string;
  user_id?: string | null;
  faculty_id?: string | null;
  profile_id?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
}

function isAdminRole(role: string | undefined) {
  return role === ROLE.ADMIN || role === ROLE.SUPER_ADMIN;
}

function sanitizeSegment(value: string): string {
  return value
    .replace(/[/\\?%*:|"<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatFacultyName(
  profile: ProfileRow | undefined | null,
  fallbackId: string | null | undefined
): string {
  if (profile) {
    // 1. `${first_name} ${last_name}` (including middle name if available)
    if (profile.first_name?.trim() && profile.last_name?.trim()) {
      const parts = [
        profile.first_name.trim(),
        profile.middle_name ? profile.middle_name.trim() : null,
        profile.last_name.trim(),
      ].filter(Boolean);
      return parts.join(" ").trim();
    }

    // 2. `full_name`
    if (profile.full_name?.trim()) {
      return profile.full_name.trim();
    }

    // 3. `email` (part before @, formatted/capitalized)
    if (profile.email?.trim()) {
      const emailPrefix = profile.email.split("@")[0].replace(/[._-]/g, " ");
      const capitalized = emailPrefix
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ")
        .trim();
      if (capitalized) return capitalized;
    }
  }

  // 4. `Faculty_${targetId.slice(0, 8)}`
  if (fallbackId && typeof fallbackId === "string") {
    const cleanId = fallbackId.replace(/[^a-zA-Z0-9]/g, "");
    return `Faculty_${cleanId.slice(0, 8) || "Member"}`;
  }

  return "Faculty_Member";
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

    const { searchParams } = new URL(request.url);
    const targetAcademicYear = searchParams.get("academic_year")?.trim() || "";
    const targetSemester = searchParams.get("semester")?.trim() || "";
    const targetFacultyId = searchParams.get("faculty_id")?.trim() || "";

    // 1. Use Service Role / Admin client to bypass RLS
    const supabaseAdmin = getServiceRoleClient();

    // 2. Fetch Requirement Templates map
    const requirementTitles = new Map<string, string>();
    try {
      const { data: templates } = await supabaseAdmin
        .from("requirement_templates")
        .select("code, title");

      if (templates) {
        for (const t of templates) {
          requirementTitles.set(t.code, t.title);
        }
      }
    } catch {
      // ignore
    }

    // 2b. Fetch faculty_program_assignments for exact term mapping
    const assignmentMap = new Map<string, { academicYear: string; semester: string }>();
    try {
      const { data: assignments } = await supabaseAdmin
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
      console.warn("faculty_program_assignments query note in export-zip:", err);
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

    // 3. Query multiple profile sources via supabaseAdmin into a unified map
    const profileMap = new Map<string, ProfileRow>();

    const recordProfile = (p: Record<string, unknown>) => {
      const id = typeof p.id === "string" ? p.id : "";
      const userId = typeof p.user_id === "string" ? p.user_id : null;
      const facultyId = typeof p.faculty_id === "string" ? p.faculty_id : null;
      const profileId = typeof p.profile_id === "string" ? p.profile_id : null;
      const firstName = typeof p.first_name === "string" ? p.first_name : null;
      const middleName = typeof p.middle_name === "string" ? p.middle_name : null;
      const lastName = typeof p.last_name === "string" ? p.last_name : null;
      const fullName = typeof p.full_name === "string" ? p.full_name : null;
      const email = typeof p.email === "string" ? p.email : null;
      const department = typeof p.department === "string" ? p.department : null;

      const row: ProfileRow = {
        id: id || profileId || userId || "",
        user_id: userId,
        faculty_id: facultyId,
        profile_id: profileId,
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        full_name: fullName,
        email: email,
        department: department,
      };

      if (id) profileMap.set(id, row);
      if (userId) profileMap.set(userId, row);
      if (facultyId) profileMap.set(facultyId, row);
      if (profileId) profileMap.set(profileId, row);
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

    // Identify admin and superadmin accounts via auth users
    const adminUserIds = new Set<string>();
    const adminEmails = new Set<string>();

    try {
      const { data: authData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
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
        }
      }
    } catch (err) {
      console.warn("Error checking auth users in export-zip route:", err);
    }

    // 3. Query profiles table (recording genuine faculty only)
    try {
      const { data: profiles, error: pError } = await supabaseAdmin
        .from("profiles")
        .select("*");

      if (pError) {
        console.warn("profiles query note:", pError.message);
      } else if (profiles && Array.isArray(profiles)) {
        for (const p of profiles) {
          const em = (p.email || "").toLowerCase().trim();
          if (
            adminUserIds.has(p.id) ||
            (p.user_id && adminUserIds.has(p.user_id)) ||
            adminEmails.has(em) ||
            isAdministrativeAccount(p)
          ) {
            continue;
          }
          recordProfile(p as Record<string, unknown>);
        }
      }
    } catch (profileErr) {
      console.warn("profiles table query note:", profileErr);
    }

    // 4. Fetch Submissions
    const { data: submissions, error: subError } = await supabaseAdmin
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status, submitted_at, created_at, remarks, admin_remarks, faculty_assignment_id");

    if (subError) {
      return NextResponse.json(
        { error: "Failed to query submissions", details: subError.message },
        { status: 500 }
      );
    }

    const submissionIds = (submissions || []).map((s) => s.id);

    // 5. Fetch Document Versions
    const docVersionsMap = new Map<string, Array<{ storage_path: string; id: string }>>();
    if (submissionIds.length > 0) {
      try {
        const { data: docVersions } = await supabaseAdmin
          .from("document_versions")
          .select("id, submission_id, storage_path")
          .in("submission_id", submissionIds);

        if (docVersions) {
          for (const doc of docVersions) {
            const list = docVersionsMap.get(doc.submission_id) || [];
            list.push(doc);
            docVersionsMap.set(doc.submission_id, list);
          }
        }
      } catch {
        // ignore
      }
    }

    // Filter submissions by Academic Year, Semester, and Faculty if specified
    const filteredSubmissions = (submissions || []).filter((sub) => {
      const rawSub = sub as Record<string, unknown>;
      const targetId =
        (typeof rawSub.faculty_id === "string" ? rawSub.faculty_id : null) ||
        (typeof rawSub.faculty_profile_id === "string" ? rawSub.faculty_profile_id : null) ||
        (typeof rawSub.user_id === "string" ? rawSub.user_id : null) ||
        (typeof rawSub.created_by === "string" ? rawSub.created_by : null) ||
        (typeof rawSub.profile_id === "string" ? rawSub.profile_id : null);

      // Exclude submissions belonging to administrative accounts
      if (targetId && adminUserIds.has(targetId)) {
        return false;
      }
      if (sub.faculty_profile_id && adminUserIds.has(sub.faculty_profile_id)) {
        return false;
      }

      // 1. Faculty Filter
      if (targetFacultyId && targetFacultyId !== "all") {
        const matchesDirect = targetId === targetFacultyId || sub.faculty_profile_id === targetFacultyId;
        const matchedProf = targetId ? profileMap.get(targetId) : null;
        const matchesProf = Boolean(
          matchedProf && (
            matchedProf.id === targetFacultyId ||
            matchedProf.user_id === targetFacultyId ||
            matchedProf.faculty_id === targetFacultyId ||
            matchedProf.profile_id === targetFacultyId
          )
        );

        if (!matchesDirect && !matchesProf) {
          return false;
        }
      }

      // 2. Academic Year & Semester Filter
      const termInfo = getTermInfo(sub);

      if (targetAcademicYear && targetAcademicYear !== "all") {
        const ayMatch =
          termInfo.academicYear.toLowerCase() === targetAcademicYear.toLowerCase() ||
          termInfo.academicYear.replace(/[^0-9]/g, "") === targetAcademicYear.replace(/[^0-9]/g, "");

        if (!ayMatch) return false;
      }

      if (targetSemester && targetSemester !== "all") {
        const semMatch =
          termInfo.semester.toLowerCase().includes(targetSemester.toLowerCase()) ||
          targetSemester.toLowerCase().includes(termInfo.semester.toLowerCase());
        if (!semMatch) return false;
      }

      return true;
    });

    const zip = new JSZip();
    let fileCount = 0;

    // Build hierarchical folders inside ZIP: [Academic Year - Semester] / [Faculty Full Name] / [Requirement Title]_[Filename]
    for (const sub of filteredSubmissions) {
      const termInfo = getTermInfo(sub);
      const termFolderName = sanitizeSegment(`${termInfo.academicYear} - ${termInfo.semester}`);
      
      // Multi-Field Foreign Key Resolution with console.log debugging
      const rawSub = sub as Record<string, unknown>;
      const targetId =
        (typeof rawSub.faculty_id === "string" ? rawSub.faculty_id : null) ||
        (typeof rawSub.faculty_profile_id === "string" ? rawSub.faculty_profile_id : null) ||
        (typeof rawSub.user_id === "string" ? rawSub.user_id : null) ||
        (typeof rawSub.created_by === "string" ? rawSub.created_by : null) ||
        (typeof rawSub.profile_id === "string" ? rawSub.profile_id : null);

      let matchedProfile = targetId ? profileMap.get(targetId) : null;

      // Last-resort fallback: Direct query to faculty_profiles or profiles
      if (!matchedProfile && targetId) {
        try {
          const { data: directFp } = await supabaseAdmin
            .from("faculty_profiles")
            .select("*")
            .or(`id.eq.${targetId},user_id.eq.${targetId}`)
            .maybeSingle();

          if (directFp) {
            recordProfile(directFp as Record<string, unknown>);
            matchedProfile = profileMap.get(targetId) || null;
          }
        } catch {
          // ignore
        }

        if (!matchedProfile) {
          try {
            const { data: directProf } = await supabaseAdmin
              .from("profiles")
              .select("*")
              .or(`id.eq.${targetId},user_id.eq.${targetId}`)
              .maybeSingle();

            if (directProf) {
              recordProfile(directProf as Record<string, unknown>);
              matchedProfile = profileMap.get(targetId) || null;
            }
          } catch {
            // ignore
          }
        }
      }

      const rawFacultyName = formatFacultyName(matchedProfile, targetId);
      const safeFacultyFolder = sanitizeSegment(rawFacultyName) || "Faculty_Member";

      const reqCode = sub.requirement_code;
      const reqTitle = sanitizeSegment(
        requirementTitles.get(reqCode) ||
        REQUIREMENT_LABEL[reqCode as RequirementCode] ||
        reqCode ||
        "Compliance_Document"
      );

      const versions = docVersionsMap.get(sub.id) || [];
      let fileDownloaded = false;

      if (versions.length > 0) {
        for (const ver of versions) {
          if (!ver.storage_path) continue;

          // Download from "faculty-submissions" or "submissions" buckets using Admin client
          let fileBlob = null;

          const { data: b1 } = await supabaseAdmin.storage
            .from("faculty-submissions")
            .download(ver.storage_path);

          if (b1) {
            fileBlob = b1;
          } else {
            const { data: b2 } = await supabaseAdmin.storage
              .from("submissions")
              .download(ver.storage_path);
            if (b2) fileBlob = b2;
          }

          if (fileBlob) {
            const fileBuffer = await fileBlob.arrayBuffer();
            const extMatch = ver.storage_path.match(/\.[a-zA-Z0-9]+$/);
            const ext = extMatch ? extMatch[0] : ".pdf";
            const fileName = `${reqTitle}_Document${ext}`;
            const zipPath = `${termFolderName}/${safeFacultyFolder}/${fileName}`;
            zip.file(zipPath, Buffer.from(fileBuffer));
            fileCount++;
            fileDownloaded = true;
          }
        }
      }

      // If no storage file was downloaded, write a verified compliance metadata entry file
      if (!fileDownloaded) {
        const recordContent = [
          `PUP FOCUS COMPLIANCE ARCHIVE RECORD`,
          `=====================================`,
          `Requirement: ${reqTitle} (${reqCode})`,
          `Faculty Member: ${rawFacultyName}`,
          `Academic Term: ${termInfo.academicYear} (${termInfo.semester})`,
          `Submission ID: ${sub.id}`,
          `Status: ${sub.status || "Submitted"}`,
          `Submitted Date: ${sub.submitted_at || sub.created_at || "N/A"}`,
          `Faculty Remarks: ${sub.remarks || "None"}`,
          `Admin Verification Remarks: ${sub.admin_remarks || "Verified & Archived in Vault"}`,
          `Archived At: ${new Date().toISOString()}`,
        ].join("\n");

        const zipPath = `${termFolderName}/${safeFacultyFolder}/${reqTitle}_Compliance_Manifest.txt`;
        zip.file(zipPath, recordContent);
        fileCount++;
      }
    }

    // Resolve target faculty name if scoped
    let targetFacultyName = "";
    if (targetFacultyId && targetFacultyId !== "all") {
      const targetProf = profileMap.get(targetFacultyId);
      targetFacultyName = formatFacultyName(targetProf, targetFacultyId);
    }

    // Add root vault index readme
    const readmeContent = [
      `PUP FOCUS INSTITUTIONAL DOCUMENT VAULT`,
      `=====================================`,
      `Export Timestamp: ${new Date().toISOString()}`,
      `Filter Academic Year: ${targetAcademicYear && targetAcademicYear !== "all" ? targetAcademicYear : "All Academic Years"}`,
      `Filter Semester: ${targetSemester && targetSemester !== "all" ? targetSemester : "All Semesters"}`,
      `Filter Faculty: ${targetFacultyName || "All Faculty Members"}`,
      `Total Document Records: ${fileCount}`,
      `Generated by: ${user.email || "Super Admin"}`,
      `\nDirectory Hierarchy Structure:`,
      `[Academic Year - Semester] / [Faculty Full Name] / [Requirement Title]_[Filename]`,
    ].join("\n");

    zip.file("VAULT_MANIFEST.txt", readmeContent);

    const archive = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
    });

    const safeAY = targetAcademicYear && targetAcademicYear !== "all" ? sanitizeSegment(targetAcademicYear) : "All_AY";
    const safeSem = targetSemester && targetSemester !== "all" ? sanitizeSegment(targetSemester) : "All_Sem";
    const safeFac = targetFacultyName ? sanitizeSegment(targetFacultyName).replace(/\s+/g, "_") : "";
    const zipName = safeFac
      ? `PUP_FOCUS_Document_Vault_${safeFac}_${safeAY}_${safeSem}.zip`
      : `PUP_FOCUS_Document_Vault_${safeAY}_${safeSem}.zip`;

    const archiveBuffer = archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength
    ) as ArrayBuffer;

    // --- Persist ZIP download to system_backups so it appears in the backup list ---
    const archiveSizeKb = Math.max(1, Math.round(archiveBuffer.byteLength / 1024));
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const backupName = safeFac
      ? `Vault_ZIP_${safeFac}_${safeAY}_${safeSem}_${dateStr}`
      : `Vault_ZIP_${safeAY}_${safeSem}_${dateStr}`;

    // Resolve creator profile ID for created_by FK
    let creatorProfileId: string | null = null;
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof?.id) creatorProfileId = prof.id;
    } catch {
      // ignore — FK mismatch handled by retry below
    }

    const scopeMeta = {
      academic_year: targetAcademicYear && targetAcademicYear !== "all" ? targetAcademicYear : null,
      semester: targetSemester && targetSemester !== "all" ? targetSemester : null,
      faculty_id: targetFacultyId && targetFacultyId !== "all" ? targetFacultyId : null,
      faculty_name: targetFacultyName || null,
    };

    const zipBackupPayload = {
      backup_name: backupName,
      academic_year: scopeMeta.academic_year,
      total_records: fileCount,
      file_size_kb: archiveSizeKb,
      status: "completed" as const,
      created_by: creatorProfileId,
      metadata: {
        type: "document_vault_zip",
        scope: scopeMeta,
        file_count: fileCount,
        zip_name: zipName,
      },
    };

    try {
      const { error: insertErr } = await supabaseAdmin
        .from("system_backups")
        .insert(zipBackupPayload);

      if (insertErr && creatorProfileId) {
        // Retry without created_by if FK constraint fails
        await supabaseAdmin
          .from("system_backups")
          .insert({ ...zipBackupPayload, created_by: null });
      }
    } catch {
      // ignore — backup record failure must not block the file download
    }

    // Audit log: ZIP vault exported
    await logAudit({
      actorId: user.id,
      action: AUDIT_ACTION.BACKUP_EXPORT_ZIP,
      entityType: "document_vault",
      entityId: null,
      metadata: {
        zip_name: zipName,
        file_count: fileCount,
        scope: {
          academic_year: targetAcademicYear ?? "all",
          semester: targetSemester ?? "all",
          faculty_id: targetFacultyId ?? "all",
          faculty_name: targetFacultyName ?? "all",
        },
      },
    });

    return new NextResponse(archiveBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/backups/export-zip error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate document vault ZIP archive",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
