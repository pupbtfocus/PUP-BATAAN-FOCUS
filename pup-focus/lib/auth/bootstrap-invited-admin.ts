import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function bootstrapInvitedAdminAccount(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};

  if (
    metadata.role !== ROLE.ADMIN ||
    metadata.created_via !== "super_admin_admin_panel"
  ) {
    return;
  }

  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : (user.email ?? "Admin User");
  const email = user.email?.trim().toLowerCase();

  if (!email) {
    throw new Error("Missing email for invited admin account");
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

  const { data: adminRole, error: adminRoleError } = await serviceRoleClient
    .from("roles")
    .select("id")
    .eq("code", ROLE.ADMIN)
    .single();

  if (adminRoleError || !adminRole) {
    throw new Error("Admin role not found. Seed roles first.");
  }

  const inviteMetadata = {
    is_active: true,
    created_via: "super_admin_admin_panel",
    created_by_super_admin_id:
      typeof metadata.created_by_super_admin_id === "string"
        ? metadata.created_by_super_admin_id
        : null,
    invite_accepted_at: new Date().toISOString(),
  };

  const { error: userRoleError } = await serviceRoleClient
    .from("user_roles")
    .upsert(
      {
        profile_id: profile.id,
        role_id: adminRole.id,
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
        role: ROLE.ADMIN,
        metadata: inviteMetadata,
      },
      { onConflict: "email" },
    );

  if (appUsersError) {
    throw new Error(appUsersError.message);
  }

  const { error: adminTableError } = await serviceRoleClient
    .from("admins")
    .upsert(
      {
        profile_id: profile.id,
        full_name: fullName,
        email,
        is_active: true,
      },
      { onConflict: "email" },
    );

  if (adminTableError) {
    throw new Error(adminTableError.message);
  }
}
