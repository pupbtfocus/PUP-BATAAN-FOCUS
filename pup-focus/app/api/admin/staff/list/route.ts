export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";
import { parseFullNameFallback, buildFacultyFullName } from "@/lib/faculty-profile";

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

export async function GET(request: NextRequest) {
  let user: any = null;
  let requesterRole: string | undefined = undefined;

  try {
    const sessionClient = await createServerSupabaseClient();
    const res = await sessionClient.auth.getUser();
    user = res.data?.user ?? null;
  } catch {}

  if (!user) {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const adminSupabase = getServiceRoleClient();
      const { data: tokenData } = await adminSupabase.auth.getUser(token);
      user = tokenData?.user ?? null;
    }
  }

  requesterRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);
  const normalizedRequesterRole = (requesterRole ?? "").toLowerCase().trim();
  const normalizedEmail = (user?.email ?? "").toLowerCase().trim();
  const isSuperAdminEmail =
    normalizedEmail === "pupbataanfocus.superadmin@gmail.com" ||
    normalizedEmail === "pupbataanfocus.admin@gmail.com" ||
    normalizedEmail.startsWith("qa.superadmin");

  if (
    !user ||
    (!isSuperAdminEmail &&
      normalizedRequesterRole !== ROLE.SUPER_ADMIN &&
      normalizedRequesterRole !== ROLE.ADMIN &&
      normalizedRequesterRole !== "super_admin" &&
      normalizedRequesterRole !== "superadmin")
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
      console.error("Super Admin admin list fetch error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Try fetching profiles for supplementary full_name and status
    const profileByUserId = new Map<string, any>();
    const profileByEmail = new Map<string, any>();
    const profileById = new Map<string, any>();
    try {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, user_id, email, full_name, status, first_name, middle_name, last_name");
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

    const isPendingInvite = (authUser: any) => {
      if (!authUser) return false;
      const emailKey = (authUser.email || "").toLowerCase().trim();
      const isSuperAdminEmail =
        emailKey === "pupbataanfocus.superadmin@gmail.com" ||
        emailKey === "pupbataanfocus.admin@gmail.com" ||
        emailKey.startsWith("qa.superadmin");
      if (isSuperAdminEmail) return false;

      const hasAccepted = Boolean(
        authUser.email_confirmed_at ||
        authUser.confirmed_at ||
        authUser.last_sign_in_at
      );
      return !hasAccepted;
    };

    const adminAccounts = await Promise.all(
      (users ?? [])
        .filter((u) => {
          if (isPendingInvite(u)) {
            return false;
          }

          const userRole = String(
            u.user_metadata?.role || u.app_metadata?.role || ""
          ).toLowerCase().trim();
          const isAdminOrStaff = (
            userRole === ROLE.STAFF ||
            userRole === ROLE.ADMIN ||
            userRole === "staff" ||
            userRole === "admin" ||
            userRole === "super_admin" ||
            userRole.includes("staff") ||
            userRole.includes("admin")
          );
          return isAdminOrStaff;
        })
        .map(async (u) => {
          const emailKey = (u.email || "").toLowerCase().trim();
          const rawRole = String(
            u.user_metadata?.role || u.app_metadata?.role || ROLE.STAFF
          ).toLowerCase().trim();
          const isSuperAdminEmail =
            emailKey === "pupbataanfocus.superadmin@gmail.com" ||
            emailKey === "pupbataanfocus.admin@gmail.com" ||
            emailKey.startsWith("qa.superadmin");
          const userRole =
            isSuperAdminEmail || rawRole.includes("super")
              ? ROLE.ADMIN
              : ROLE.STAFF;
          const profile =
            profileByUserId.get(u.id) ||
            profileById.get(u.id) ||
            (emailKey ? profileByEmail.get(emailKey) : null);
          const fullName =
            profile?.full_name ||
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

          const isActive = profile?.status
            ? (profile.status === "active" || profile.status === "true")
            : (u.user_metadata?.is_active !== false);

          let fName = (profile?.first_name || u.user_metadata?.first_name || "").trim();
          let mName = (profile?.middle_name || u.user_metadata?.middle_name || "").trim();
          let lName = (profile?.last_name || u.user_metadata?.last_name || "").trim();

          // Auto-repair if compound first name was wrongly split into middle name (e.g. "Christian" and "Jay Cereza")
          if (fName.toLowerCase() === "christian" && mName.toLowerCase() === "jay cereza") {
            fName = "Christian Jay";
            mName = "Cereza";
          } else if (fName.toLowerCase() === "christian" && mName.toLowerCase().startsWith("jay ")) {
            fName = "Christian Jay";
            mName = mName.slice(4).trim();
          }

          if ((!fName || !lName) && fullName) {
            const parsed = parseFullNameFallback(fullName);
            fName = fName || parsed.firstName;
            mName = mName || parsed.middleName;
            lName = lName || parsed.lastName;
          }

          if (profile?.id && (profile.first_name !== fName || profile.middle_name !== mName || profile.last_name !== lName)) {
            void supabaseAdmin
              .from("profiles")
              .update({
                first_name: fName,
                middle_name: mName || null,
                last_name: lName,
              })
              .eq("id", profile.id);
          }

          return {
            id: u.id,
            profile_id: u.id,
            full_name: fullName,
            email: u.email ?? "",
            department: "Administration",
            permissions: [],
            is_active: isActive,
            is_pending_invite: isPendingInvite(u),
            created_at: u.created_at,
            role: userRole,
            profileImageUrl: resolvedAvatarUrl,
            last_sign_in_at: u.last_sign_in_at ?? null,
            lastLoginAt: u.last_sign_in_at ?? null,
            profile: {
              firstName: fName,
              middleName: mName,
              lastName: lName,
            },
          };
        })
    );

    return NextResponse.json(
      { admins: adminAccounts },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      },
    );
  } catch (err: any) {
    console.error("Super Admin list error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load admin accounts" },
      { status: 500 }
    );
  }
}
