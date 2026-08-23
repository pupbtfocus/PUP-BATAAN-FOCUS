import { ROLE } from "@/config/roles";
import {
  FACULTY_PROFILE_IMAGE_BUCKET,
  buildFacultyFullName,
} from "@/lib/faculty-profile";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function bootstrapInvitedAdminAccount(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const metadata = user.user_metadata ?? {};
  const firstName =
    typeof metadata.first_name === "string" ? metadata.first_name.trim() : "";
  const middleName =
    typeof metadata.middle_name === "string" ? metadata.middle_name.trim() : "";
  const lastName =
    typeof metadata.last_name === "string" ? metadata.last_name.trim() : "";

  if (
    metadata.role !== ROLE.ADMIN ||
    metadata.created_via !== "super_admin_admin_panel"
  ) {
    return;
  }

  const fullName =
    buildFacultyFullName({
      firstName,
      middleName,
      lastName,
    }) ||
    (typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name.trim()
      : (user.email ?? "Admin User"));
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
    throw new Error("Missing email for invited admin account");
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

  const { data: adminRole, error: adminRoleError } = await serviceRoleClient
    .from("roles")
    .select("id")
    .eq("code", ROLE.ADMIN)
    .single();

  if (adminRoleError || !adminRole) {
    throw new Error("Admin role not found. Seed roles first.");
  }

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
