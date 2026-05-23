import { ROLE } from "@/config/roles";
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

  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : (user.email ?? "Faculty User");
  const email = user.email?.trim().toLowerCase();

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
