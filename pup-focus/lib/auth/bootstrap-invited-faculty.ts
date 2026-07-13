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

  if (!email) {
    throw new Error("Missing email for invited faculty account");
  }

  const serviceRoleClient = getServiceRoleClient();

  const { data: existingAppUser, error: appUserError } = await serviceRoleClient
    .from("app_users")
    .select("id, profile_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (appUserError) {
    throw new Error(appUserError.message);
  }

  if (existingAppUser) {
    return;
  }

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

  const inviteMetadata = {
    is_active: true,
    created_via: "admin_faculty_panel",
    created_by_admin_id:
      typeof metadata.created_by_admin_id === "string"
        ? metadata.created_by_admin_id
        : null,
    invite_accepted_at: new Date().toISOString(),
    first_name: firstName || null,
    middle_name: middleName || null,
    last_name: lastName || null,
    full_name: fullName,
    profile_image_bucket: profileImageBucket,
    profile_image_path: profileImagePath,
  };

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

  const { error: appUsersError } = await serviceRoleClient
    .from("app_users")
    .upsert(
      {
        auth_user_id: user.id,
        profile_id: profile.id,
        email,
        full_name: fullName,
        role: ROLE.FACULTY,
        metadata: inviteMetadata,
      },
      { onConflict: "email" },
    );

  if (appUsersError) {
    throw new Error(appUsersError.message);
  }
}
