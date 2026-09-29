export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { DEFAULT_REQUIREMENTS } from "@/config/compliance";
import { ROLE } from "@/config/roles";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";

type RequirementStatus = "not_submitted" | "uploaded" | "validated";

type SubmissionRow = {
  faculty_profile_id: string;
  requirement_code: string;
  status: string | null;
  submitted_at: string | null;
  document_versions?: Array<{ id: string }> | null;
};

function buildInitialRequirementStatus() {
  return DEFAULT_REQUIREMENTS.reduce(
    (acc, requirementCode) => {
      acc[requirementCode] = "not_submitted";
      return acc;
    },
    {} as Record<(typeof DEFAULT_REQUIREMENTS)[number], RequirementStatus>,
  );
}

function toRequirementStatus(rawStatus: string | null): RequirementStatus {
  const status = (rawStatus ?? "").toLowerCase();

  if (status === "validated" || status === "approved") {
    return "validated";
  }

  if (
    status === "uploaded" ||
    status === "submitted" ||
    status === "under_review" ||
    status === "pending_review" ||
    status === "pending"
  ) {
    return "uploaded";
  }

  return "not_submitted";
}

function hasDocumentVersion(submission: {
  status?: string | null;
  document_versions?: Array<{ id: string }> | null;
}): boolean {
  if (Array.isArray(submission.document_versions)) {
    return submission.document_versions.length > 0;
  }
  return Boolean(submission.status);
}

export async function GET(request: NextRequest) {
  try {
    // detect debug mode and allow unauthenticated debug only on localhost
    const url = new URL(request.url);
    const debugMode = url.searchParams.get("debug") === "1";
    const host = url.hostname;
    const allowDebugUnauth =
      debugMode &&
      (host === "localhost" || host === "127.0.0.1" || host === "::1");

    let user: any = null;
    let requesterRole: string | undefined = undefined;

    if (!allowDebugUnauth) {
      const sessionClient = await createServerSupabaseClient();
      const {
        data: { user: sessionUser },
      } = await sessionClient.auth.getUser();

      user = sessionUser;
      if (!user) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      requesterRole =
        (user?.user_metadata?.role as string | undefined) ??
        (user?.app_metadata?.role as string | undefined);

      let isAllowed =
        requesterRole === ROLE.ADMIN ||
        requesterRole === ROLE.SUPER_ADMIN ||
        (Boolean(requesterRole) && String(requesterRole).toLowerCase().includes("admin"));

      // Fallback: check database user_roles and admins tables if metadata is missing/incomplete
      if (!isAllowed) {
        const adminSupabase = getServiceRoleClient();
        const { data: dbUserRoles } = await adminSupabase
          .from("user_roles")
          .select("roles(code)")
          .eq("profile_id", user.id);

        const dbRoles = (dbUserRoles ?? []).map((r: any) => r.roles?.code);
        if (dbRoles.includes(ROLE.ADMIN) || dbRoles.includes(ROLE.SUPER_ADMIN)) {
          isAllowed = true;
        }

        if (!isAllowed) {
          const { data: profile } = await adminSupabase
            .from("profiles")
            .select("id, user_roles(roles(code))")
            .eq("user_id", user.id)
            .maybeSingle();

          const pRoles = ((profile?.user_roles as any[]) ?? []).map((r: any) => r.roles?.code);
          if (pRoles.includes(ROLE.ADMIN) || pRoles.includes(ROLE.SUPER_ADMIN)) {
            isAllowed = true;
          }
        }

        if (!isAllowed) {
          const { data: adminRecord } = await adminSupabase
            .from("admins")
            .select("id")
            .eq("email", user.email?.toLowerCase())
            .maybeSingle();
          if (adminRecord) {
            isAllowed = true;
          }
        }
      }

      if (!isAllowed) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const supabase = getServiceRoleClient();

    const { data: facultyRole, error: roleError } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    if (roleError) {
      console.error("Failed to fetch faculty role in /api/admin/faculty/list:", roleError);
      return NextResponse.json(
        { error: "Failed to fetch faculty role", details: roleError.message },
        { status: 500 },
      );
    }

    if (!facultyRole?.id) {
      return NextResponse.json({ faculty: [] });
    }

    // Resilient discovery: query all sources in parallel
    const [
      { data: userRoles, error: userRolesError },
      { data: authUsersData, error: authUsersError },
      { data: allAssignments, error: assignmentsError },
      { data: allProfiles, error: profilesError },
      { data: allPrograms, error: programsError },
    ] = await Promise.all([
      supabase
        .from("user_roles")
        .select("profile_id")
        .eq("role_id", facultyRole.id)
        .limit(1000),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase
        .from("faculty_program_assignments")
        .select("id, faculty_profile_id, program_id, academic_year, term, programs(id, code, name)"),
      supabase
        .from("profiles")
        .select("id, user_id, full_name, email, created_at"),
      supabase.from("programs").select("id, code, name"),
    ]);

    if (userRolesError) {
      console.error("Failed to fetch user_roles in /api/admin/faculty/list:", userRolesError);
    }
    if (authUsersError) {
      console.error("Failed to fetch auth users in /api/admin/faculty/list:", authUsersError);
    }
    if (assignmentsError) {
      console.error("Failed to fetch faculty program assignments in /api/admin/faculty/list:", assignmentsError);
    }
    if (profilesError) {
      console.error("Failed to fetch profiles in /api/admin/faculty/list:", profilesError);
    }
    if (programsError) {
      console.error("Failed to fetch programs in /api/admin/faculty/list:", programsError);
    }

    const profileById = new Map<string, any>();
    const profileByUserId = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    for (const p of allProfiles ?? []) {
      if (p.id) profileById.set(p.id, p);
      if (p.user_id) profileByUserId.set(p.user_id, p);
      if (p.email) profileByEmail.set(p.email.toLowerCase(), p);
    }

    const authUsersById = new Map<string, any>();
    const authUsersByEmail = new Map<string, any>();
    for (const u of authUsersData?.users ?? []) {
      if (u.id) authUsersById.set(u.id, u);
      if (u.email) authUsersByEmail.set(u.email.toLowerCase(), u);
    }

    const facultyProfileIdSet = new Set<string>();
    const existingUserRoleProfileIds = new Set<string>();

    const isPendingInvite = (authUser: any) => {
      if (!authUser) return false;
      const hasAccepted = Boolean(
        authUser.email_confirmed_at ||
        authUser.confirmed_at ||
        authUser.last_sign_in_at
      );
      return !hasAccepted;
    };

    // 1) From user_roles
    for (const ur of userRoles ?? []) {
      if (ur.profile_id) {
        facultyProfileIdSet.add(ur.profile_id);
        existingUserRoleProfileIds.add(ur.profile_id);
      }
    }

    // 2) From auth.users where role === 'faculty'
    for (const u of authUsersData?.users ?? []) {
      if (isPendingInvite(u)) {
        continue; // Don't list pending invited faculty until they accept the invite!
      }
      const metaRole = (
        u.user_metadata?.role ||
        u.app_metadata?.role ||
        ""
      ).toLowerCase().trim();
      if (metaRole === "faculty" || metaRole === "faculty_member") {
        let prof =
          profileByUserId.get(u.id) ||
          (u.email ? profileByEmail.get(u.email.toLowerCase()) : null);

        // If profile doesn't exist yet, auto-create it
        if (!prof && u.email) {
          const firstName = (u.user_metadata?.first_name as string) || "";
          const middleName = (u.user_metadata?.middle_name as string) || "";
          const lastName = (u.user_metadata?.last_name as string) || "";
          const fullName =
            (u.user_metadata?.full_name as string) ||
            buildFacultyFullName({ firstName, middleName, lastName }) ||
            u.email;

          const { data: createdProfile } = await supabase
            .from("profiles")
            .upsert(
              {
                user_id: u.id,
                email: u.email.toLowerCase(),
                full_name: fullName,
              },
              { onConflict: "user_id" }
            )
            .select("id, user_id, full_name, email, created_at")
            .maybeSingle();

          if (createdProfile) {
            prof = createdProfile;
            profileById.set(prof.id, prof);
            profileByUserId.set(u.id, prof);
            profileByEmail.set(u.email.toLowerCase(), prof);
          }
        }

        if (prof?.id) {
          facultyProfileIdSet.add(prof.id);
        }
      }
    }

    // 3) From faculty_program_assignments
    for (const a of allAssignments ?? []) {
      if (a.faculty_profile_id) {
        facultyProfileIdSet.add(a.faculty_profile_id);
      }
    }

    // Exclude any pending invited faculty who have not accepted their invite yet
    for (const pId of Array.from(facultyProfileIdSet)) {
      const p = profileById.get(pId);
      const authUser =
        (p?.user_id ? authUsersById.get(p.user_id) : null) ||
        (p?.email ? authUsersByEmail.get(p.email.toLowerCase()) : null);
      if (authUser && isPendingInvite(authUser)) {
        facultyProfileIdSet.delete(pId);
      }
    }

    // Self-healing: Ensure user_roles exists for every faculty profile
    for (const pId of facultyProfileIdSet) {
      if (!existingUserRoleProfileIds.has(pId)) {
        void supabase
          .from("user_roles")
          .upsert(
            { profile_id: pId, role_id: facultyRole.id },
            { onConflict: "profile_id,role_id" }
          );
      }
    }

    const profileIds = Array.from(facultyProfileIdSet);

    if (profileIds.length === 0) {
      if (debugMode) {
        return NextResponse.json({
          debug: true,
          facultyCount: 0,
          profileIdsSample: [],
          profilesSample: [],
          queryError: null,
        });
      }

      return NextResponse.json({ faculty: [] });
    }

    const profiles = profileIds
      .map((id) => profileById.get(id))
      .filter(Boolean);

    const queryError = profilesError;

    const { data: submissionRows, error: submissionsError } = await supabase
      .from("submissions")
      .select(
        "faculty_profile_id, requirement_code, status, submitted_at, faculty_assignment_id",
      )
      .in("faculty_profile_id", profileIds)
      .order("submitted_at", { ascending: false })
      .limit(5000);

    if (submissionsError) {
      console.error("Failed to fetch submissions in /api/admin/faculty/list:", submissionsError);
      return NextResponse.json(
        {
          error: "Failed to fetch faculty submissions",
          details: submissionsError.message,
        },
        { status: 500 },
      );
    }

    const statusRank: Record<RequirementStatus, number> = {
      not_submitted: 0,
      uploaded: 1,
      validated: 2,
    };

    const requirementStatusByProfileId = new Map<
      string,
      Record<(typeof DEFAULT_REQUIREMENTS)[number], RequirementStatus>
    >();

    for (const profileId of profileIds) {
      requirementStatusByProfileId.set(
        profileId,
        buildInitialRequirementStatus(),
      );
    }

    function normalizeSemester(sem?: string | null): string {
      if (!sem) return "";
      const s = sem.toLowerCase().trim();
      if (s.includes("1") || s.includes("first") || s.includes("1st")) return "1st semester";
      if (s.includes("2") || s.includes("second") || s.includes("2nd")) return "2nd semester";
      return s;
    }

    function normalizeAcademicYear(ay?: string | null): string {
      if (!ay) return "";
      return ay.toLowerCase().trim().replace(/^s\.?y\.?\s*/i, "").replace(/^a\.?y\.?\s*/i, "");
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

    const { data: activeTerm } = await supabase
      .from("academic_terms")
      .select("academic_year, semester")
      .eq("status", "Current")
      .maybeSingle();

    const activeAY = activeTerm?.academic_year
      ? normalizeAcademicYear(activeTerm.academic_year)
      : null;
    const activeSem = activeTerm?.semester
      ? normalizeSemester(activeTerm.semester)
      : null;

    const activeAssignmentIdSet = new Set(
      (allAssignments ?? [])
        .filter(
          (a: any) =>
            normalizeAcademicYear(a.academic_year) === activeAY &&
            normalizeSemester(a.term) === activeSem,
        )
        .map((a: any) => a.id),
    );

    for (const row of (submissionRows ?? []) as (SubmissionRow & { faculty_assignment_id?: string | null })[]) {
      const profileId = row.faculty_profile_id;
      const requirementCode = row.requirement_code as
        | (typeof DEFAULT_REQUIREMENTS)[number]
        | undefined;

      if (
        !profileId ||
        !requirementCode ||
        !DEFAULT_REQUIREMENTS.includes(requirementCode)
      ) {
        continue;
      }

      if (!hasDocumentVersion(row)) {
        continue;
      }

      if (activeAY && activeSem) {
        if (row.faculty_assignment_id && activeAssignmentIdSet.size > 0) {
          if (!activeAssignmentIdSet.has(row.faculty_assignment_id)) {
            continue;
          }
        } else if (row.submitted_at) {
          const subTerm = toAcademicYearAndSemester(row.submitted_at);
          if (
            normalizeAcademicYear(subTerm.academicYear) !== activeAY ||
            normalizeSemester(subTerm.semester) !== activeSem
          ) {
            continue;
          }
        }
      }

      const mappedStatus = toRequirementStatus(row.status);
      const currentStatus = requirementStatusByProfileId.get(profileId);

      if (
        currentStatus &&
        statusRank[mappedStatus] > statusRank[currentStatus[requirementCode]]
      ) {
        currentStatus[requirementCode] = mappedStatus;
      }
    }

    if (debugMode) {
      return NextResponse.json({
        debug: true,
        facultyCount: profiles?.length ?? 0,
        profileIdsSample: profileIds.slice(0, 50),
        profilesSample: profiles ?? [],
        queryError: queryError ? queryError.message : null,
      });
    }

    if (queryError) {
      return NextResponse.json(
        { error: "Failed to fetch faculty", details: queryError.message },
        { status: 500 },
      );
    }

    const programAssignments = (allAssignments ?? []).filter((a: any) =>
      profileIds.includes(a.faculty_profile_id),
    );

    const programByProfileId = new Map<
      string,
      { id: string; code: string; name: string }
    >();

    const programsLookup = new Map<string, { id: string; code: string; name: string }>();
    for (const prog of (allPrograms ?? []) as Array<{ id: string; code: string; name: string }>) {
      if (prog?.id) programsLookup.set(prog.id.toLowerCase(), prog);
      if (prog?.code) programsLookup.set(prog.code.toUpperCase(), prog);
    }

    for (const row of (programAssignments ?? []) as any[]) {
      if (row.faculty_profile_id && row.programs) {
        const prog = Array.isArray(row.programs) ? row.programs[0] : row.programs;
        if (prog?.id && prog?.code && prog?.name) {
          programByProfileId.set(row.faculty_profile_id, {
            id: prog.id,
            code: prog.code,
            name: prog.name,
          });
        }
      }
    }

    const faculty = await Promise.all(
      (profiles ?? []).map(async (profile: any) => {
        const authUser =
          (profile?.user_id ? authUsersById.get(profile.user_id) : null) ??
          (profile?.id ? authUsersById.get(profile.id) : null) ??
          (profile?.email ? authUsersByEmail.get(profile.email.toLowerCase()) : null) ??
          null;
        const authUserMetadata = authUser?.user_metadata ?? {};
        const lastSignInAt = authUser?.last_sign_in_at ?? null;
        const metadata = authUserMetadata as Record<string, unknown>;

        const firstName =
          typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
        const middleName =
          typeof metadata.middle_name === "string" ? metadata.middle_name.trim() : "";
        const lastName =
          typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";

        const fullNameFromMetadata = buildFacultyFullName({
          firstName,
          middleName,
          lastName,
        });

        // Resolve assigned program: 1) from faculty_program_assignments, 2) fallback to auth metadata
        let resolvedProgram = programByProfileId.get(profile.id) ?? null;
        if (!resolvedProgram && metadata.program_id) {
          resolvedProgram =
            programsLookup.get(String(metadata.program_id).toLowerCase()) ??
            programsLookup.get(String(metadata.program_id).toUpperCase()) ??
            null;
        }
        if (!resolvedProgram && metadata.program_code) {
          resolvedProgram =
            programsLookup.get(String(metadata.program_code).toUpperCase()) ??
            null;
        }

        const profileImageBucket =
          typeof metadata.profile_image_bucket === "string" &&
          metadata.profile_image_bucket.trim()
            ? metadata.profile_image_bucket.trim()
            : FACULTY_PROFILE_IMAGE_BUCKET;
        const profileImagePath =
          typeof metadata.profile_image_path === "string" &&
          metadata.profile_image_path.trim()
            ? metadata.profile_image_path.trim()
            : null;
        const requirementStatus =
          requirementStatusByProfileId.get(profile.id) ??
          buildInitialRequirementStatus();

        let profileImageUrl: string | null = null;

        if (profileImagePath) {
          const { data: signedImage, error: signedImageError } =
            await supabase.storage
              .from(profileImageBucket)
              .createSignedUrl(profileImagePath, 60 * 60 * 24);

          if (!signedImageError) {
            profileImageUrl = signedImage.signedUrl;
          }
        }

        return {
          id: profile.id,
          user_id: profile.user_id ?? null,
          fullName: fullNameFromMetadata || profile.full_name || "Unknown",
          firstName: firstName || "",
          middleName: middleName || "",
          lastName: lastName || "",
          first_name: firstName || "",
          middle_name: middleName || "",
          last_name: lastName || "",
          email: profile.email || "Unknown",
          profileImageUrl,
          program: resolvedProgram,
          is_active: (metadata.is_active as boolean | undefined) ?? true,
          created_at: profile.created_at || new Date().toISOString(),
          last_sign_in_at: lastSignInAt,
          lastLoginAt: lastSignInAt,
          requirementStatus,
        };
      }),
    );

    faculty.sort((a: any, b: any) => a.fullName.localeCompare(b.fullName));

    return NextResponse.json(
      { faculty },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("Unhandled error in /api/admin/faculty/list:", error);
    return NextResponse.json(
      { error: "Failed to fetch faculty", details: String(error) },
      { status: 500 },
    );
  }
}
