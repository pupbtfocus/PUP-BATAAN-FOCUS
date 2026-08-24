import { ROLE } from "@/config/roles";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function bootstrapInvitedFacultyAccount(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};

  if (
    metadata.role !== ROLE.FACULTY ||
    metadata.created_via !== "admin_faculty_panel"
  ) {
    return;
  }

  const firstName =
    typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
  const middleName =
    typeof metadata.middle_name === "string" ? metadata.middle_name.trim() : "";
  const lastName =
    typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";
  const fullNameFromParts = buildFacultyFullName({
    firstName,
    middleName,
    lastName,
  });
  const fullName =
    fullNameFromParts ||
    (typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : (user.email ?? "Faculty User"));
  const email = user.email?.trim().toLowerCase();
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
  const programId =
    typeof metadata.program_id === "string" && metadata.program_id.trim()
      ? metadata.program_id.trim()
      : null;

  if (!email) {
    throw new Error("Missing email for invited faculty account");
  }

  const serviceRoleClient = getServiceRoleClient();

  const { data: profile, error: profileError } = await serviceRoleClient
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        full_name: fullName,
        email,
      },
      { onConflict: "user_id" },
    )
    .select("id")
    .single();

  if (profileError || !profile) {
    throw new Error(profileError?.message ?? "Failed to create profile");
  }

  const { data: facultyRole, error: facultyRoleError } = await serviceRoleClient
    .from("roles")
    .select("id")
    .eq("code", ROLE.FACULTY)
    .single();

  if (facultyRoleError || !facultyRole) {
    throw new Error("Faculty role not found. Seed roles first.");
  }

  const { error: userRoleError } = await serviceRoleClient
    .from("user_roles")
    .upsert(
      {
        profile_id: profile.id,
        role_id: facultyRole.id,
      },
      { onConflict: "profile_id,role_id" },
    );

  if (userRoleError) {
    throw new Error(userRoleError.message);
  }

  // Ensure faculty program assignment is persisted
  if (programId && profile?.id) {
    const { data: existingAssignment } = await serviceRoleClient
      .from("faculty_program_assignments")
      .select("id")
      .eq("faculty_profile_id", profile.id)
      .eq("program_id", programId)
      .maybeSingle();

    if (!existingAssignment) {
      const { data: activeTerm } = await serviceRoleClient
        .from("academic_terms")
        .select("academic_year, semester")
        .eq("status", "Current")
        .maybeSingle();

      const academicYear = activeTerm?.academic_year || "2026-2027";
      const term = activeTerm?.semester || "1st Semester";

      await serviceRoleClient.from("faculty_program_assignments").insert({
        faculty_profile_id: profile.id,
        program_id: programId,
        academic_year: academicYear,
        term,
      });
    }
  }
}
