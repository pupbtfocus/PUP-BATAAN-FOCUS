export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

async function resolveAvatarUrl(
  supabaseAdmin: any,
  email?: string | null,
  rawAvatarUrl?: string | null
): Promise<string | null> {
  // 1. If rawAvatarUrl is already a valid full HTTP URL
  if (rawAvatarUrl && rawAvatarUrl.startsWith("http")) {
    return rawAvatarUrl;
  }

  // 2. If rawAvatarUrl is a storage path or partial path
  if (rawAvatarUrl) {
    let storagePath = rawAvatarUrl;
    if (storagePath.includes("/avatars/")) {
      storagePath = storagePath.split("/avatars/")[1].split("?")[0];
    } else if (storagePath.includes("/profile-pictures/")) {
      storagePath = storagePath.split("/profile-pictures/")[1].split("?")[0];
    }

    const { data: publicData } = supabaseAdmin.storage
      .from("avatars")
      .getPublicUrl(storagePath);
    if (publicData?.publicUrl) {
      return publicData.publicUrl;
    }
  }

  // 3. Search 'avatars' bucket under admin/${email}
  if (email) {
    const folderPath = `admin/${email}`;
    const { data: files } = await supabaseAdmin.storage
      .from("avatars")
      .list(folderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

    if (files && files.length > 0) {
      const latestFile = files[0];
      const filePath = `${folderPath}/${latestFile.name}`;
      const { data: publicData } = supabaseAdmin.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }
    }

    // Legacy fallback: Search profile-pictures bucket under admin-profile-images/${email}
    const legacyFolderPath = `admin-profile-images/${email}`;
    const { data: legacyFiles } = await supabaseAdmin.storage
      .from("profile-pictures")
      .list(legacyFolderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

    if (legacyFiles && legacyFiles.length > 0) {
      const latestFile = legacyFiles[0];
      const filePath = `${legacyFolderPath}/${latestFile.name}`;
      const { data, error } = await supabaseAdmin.storage
        .from("profile-pictures")
        .createSignedUrl(filePath, 60 * 60 * 24);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  return null;
}

export async function GET() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const requesterRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);

  if (
    !user ||
    (requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== ROLE.ADMIN)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabaseAdmin = getServiceRoleClient();

    // Fetch users directly via Auth Admin API using Service Role
    const {
      data: { users },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      console.error("Super Admin auth fetch error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Try fetching profiles, staff, admins, and user_roles for supplementary full_name, role, and status
    const profileByUserId = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    const profileById = new Map<string, any>();
    const staffByEmail = new Map<string, any>();
    const staffByProfileId = new Map<string, any>();
    const adminByEmail = new Map<string, any>();
    const adminByProfileId = new Map<string, any>();
    const roleByProfileId = new Map<string, string>();

    try {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id, email, full_name, status");
      if (profiles) {
        for (const p of profiles) {
          if (p.id) profileById.set(p.id, p);
          if (p.user_id) profileByUserId.set(p.user_id, p);
          if (p.email) profileByEmail.set(p.email.toLowerCase().trim(), p);
        }
      }
    } catch {
      // Ignore profiles table query error if schema differs
    }

    try {
      const { data: staffRows } = await supabaseAdmin
        .from("staff")
        .select("id, profile_id, email, full_name, is_active");
      if (staffRows) {
        for (const s of staffRows) {
          if (s.profile_id) staffByProfileId.set(s.profile_id, s);
          if (s.email) staffByEmail.set(s.email.toLowerCase().trim(), s);
        }
      }
    } catch {}

    try {
      const { data: adminRows } = await supabaseAdmin
        .from("admins")
        .select("id, profile_id, email, full_name, is_active");
      if (adminRows) {
        for (const a of adminRows) {
          if (a.profile_id) adminByProfileId.set(a.profile_id, a);
          if (a.email) adminByEmail.set(a.email.toLowerCase().trim(), a);
        }
      }
    } catch {}

    try {
      const { data: userRolesData } = await supabaseAdmin
        .from("user_roles")
        .select("profile_id, roles(code)");
      if (userRolesData) {
        for (const ur of userRolesData as any[]) {
          const roleObj = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
          if (roleObj?.code && ur.profile_id) {
            roleByProfileId.set(ur.profile_id, String(roleObj.code).toLowerCase().trim());
          }
        }
      }
    } catch {}

    const adminAccounts = await Promise.all(
      (users ?? [])
        .filter((u) => {
          const emailKey = (u.email || "").toLowerCase().trim();
          const profile =
            profileByUserId.get(u.id) ||
            profileById.get(u.id) ||
            (emailKey ? profileByEmail.get(emailKey) : null);
          const dbRole = profile?.id ? roleByProfileId.get(profile.id) : "";
          const hasStaffRow =
            (profile?.id && staffByProfileId.has(profile.id)) ||
            (emailKey && staffByEmail.has(emailKey));
          const hasAdminRow =
            (profile?.id && adminByProfileId.has(profile.id)) ||
            (emailKey && adminByEmail.has(emailKey));

          const rawRole = (
            u.user_metadata?.role ||
            u.app_metadata?.role ||
            dbRole ||
            (u as any).role ||
            ""
          ).toString().toLowerCase().trim();

          if (rawRole === "faculty" || rawRole === "faculty_member") {
            return false;
          }

          return (
            hasStaffRow ||
            hasAdminRow ||
            rawRole.includes("staff") ||
            rawRole.includes("admin") ||
            rawRole.includes("super") ||
            rawRole === "staff" ||
            rawRole === "admin" ||
            rawRole === "super_admin" ||
            rawRole === "superadmin"
          );
        })
        .map(async (u) => {
          const emailKey = (u.email || "").toLowerCase().trim();
          const profile =
            profileByUserId.get(u.id) ||
            profileById.get(u.id) ||
            (emailKey ? profileByEmail.get(emailKey) : null);
          const staffRow =
            (profile?.id ? staffByProfileId.get(profile.id) : null) ||
            (emailKey ? staffByEmail.get(emailKey) : null);
          const adminRow =
            (profile?.id ? adminByProfileId.get(profile.id) : null) ||
            (emailKey ? adminByEmail.get(emailKey) : null);
          const dbRole = profile?.id ? roleByProfileId.get(profile.id) : "";

          const rawRole = (
            u.user_metadata?.role ||
            u.app_metadata?.role ||
            (staffRow ? ROLE.STAFF : "") ||
            dbRole ||
            (u as any).role ||
            "staff"
          ).toString().toLowerCase().trim();

          const isSuperAdminEmail =
            emailKey === "pupbataanfocus.superadmin@gmail.com" ||
            emailKey === "pupbataanfocus.admin@gmail.com" ||
            emailKey.startsWith("qa.superadmin");

          let normalizedRole: string = ROLE.STAFF;
          if (isSuperAdminEmail || rawRole.includes("super")) {
            normalizedRole = ROLE.ADMIN;
          } else {
            normalizedRole = ROLE.STAFF;
          }

          const fullName =
            profile?.full_name ||
            staffRow?.full_name ||
            adminRow?.full_name ||
            u.user_metadata?.full_name ||
            u.user_metadata?.name ||
            u.email?.split("@")[0] ||
            "Staff User";
          const rawAvatarUrl =
            u.user_metadata?.avatar_url || u.user_metadata?.picture || null;

          const resolvedAvatarUrl = await resolveAvatarUrl(
            supabaseAdmin,
            u.email,
            rawAvatarUrl
          );

          const rawProfileStatus = (profile?.status || "").toString().toLowerCase().trim();
          const isUserActive =
            u.user_metadata?.is_active === false ||
            u.app_metadata?.is_active === false ||
            staffRow?.is_active === false ||
            adminRow?.is_active === false ||
            rawProfileStatus === "inactive" ||
            rawProfileStatus === "false"
              ? false
              : true;

          return {
            id: u.id,
            email: u.email ?? "",
            full_name: fullName,
            role: normalizedRole,
            avatar_url: resolvedAvatarUrl,
            created_at: u.created_at,
            status: isUserActive ? "active" : "inactive",
            is_active: isUserActive,
            last_sign_in_at: u.last_sign_in_at ?? null,
            lastLoginAt: u.last_sign_in_at ?? null,
          };
        })
    );

    return NextResponse.json({
      success: true,
      accounts: adminAccounts || [],
    });
  } catch (err: any) {
    console.error("Super Admin fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load admin accounts" },
      { status: 500 }
    );
  }
}
