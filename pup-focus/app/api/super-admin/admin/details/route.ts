export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { ROLE, canManageAdminAccount } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

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
    } else if (storagePath.includes("/compliance-private/")) {
      storagePath = storagePath.split("/compliance-private/")[1].split("?")[0];
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

    // Legacy fallback: Search compliance-private bucket under admin-profile-images/${email}
    const legacyFolderPath = `admin-profile-images/${email}`;
    const { data: legacyFiles } = await supabaseAdmin.storage
      .from("compliance-private")
      .list(legacyFolderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

    if (legacyFiles && legacyFiles.length > 0) {
      const latestFile = legacyFiles[0];
      const filePath = `${legacyFolderPath}/${latestFile.name}`;
      const { data, error } = await supabaseAdmin.storage
        .from("compliance-private")
        .createSignedUrl(filePath, 60 * 60 * 24);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = getServiceRoleClient();

    let profile: any = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, avatar_url, status, created_at, updated_at")
        .or(`id.eq.${profileId},user_id.eq.${profileId}`)
        .maybeSingle();
      profile = data;
    } catch {}

    const authUserId = profile?.user_id || profileId;
    let authUser: any = null;
    try {
      const authRes = await supabase.auth.admin.getUserById(authUserId);
      authUser = authRes.data?.user;
    } catch {}

    if (!profile && !authUser) {
      // Fallback search by email
      try {
        const { data: profByEmail } = await supabase
          .from("profiles")
          .select("id, user_id, full_name, email, avatar_url, status, created_at, updated_at")
          .eq("email", profileId)
          .maybeSingle();
        if (profByEmail) {
          profile = profByEmail;
          if (profByEmail.user_id) {
            const authRes = await supabase.auth.admin.getUserById(profByEmail.user_id);
            authUser = authRes.data?.user;
          }
        }
      } catch {}
    }

    if (!profile && !authUser) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const fullName =
      profile?.full_name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      authUser?.email?.split("@")[0] ||
      "Admin User";
    const email = profile?.email || authUser?.email || "";
    const role =
      authUser?.user_metadata?.role ||
      authUser?.app_metadata?.role ||
      ROLE.ADMIN;

    const rawAvatarUrl =
      profile?.avatar_url ||
      (profile as any)?.profile_image_url ||
      authUser?.user_metadata?.avatar_url ||
      authUser?.user_metadata?.picture ||
      null;

    const resolvedAvatarUrl = await resolveAvatarUrl(
      supabase,
      email,
      rawAvatarUrl
    );

    const isActive =
      profile?.status === "active" ||
      profile?.status === "true" ||
      authUser?.user_metadata?.is_active !== false;

    return NextResponse.json({
      details: {
        id: profile?.id || profileId,
        profile_id: profile?.id || profileId,
        full_name: fullName,
        email,
        role,
        department: "Administration",
        permissions: [],
        is_active: isActive,
        created_at: profile?.created_at || authUser?.created_at,
        updated_at: profile?.updated_at || authUser?.updated_at,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        lastLoginAt: authUser?.last_sign_in_at ?? null,
        profileImageUrl: resolvedAvatarUrl,
        avatar_url: resolvedAvatarUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin details", details: String(error) },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const body = await request.json();
    const { profileId, fullName, email, password } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    if (!fullName?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Check target account
    const { data: authData, error: authGetError } =
      await supabase.auth.admin.getUserById(profileId);

    if (authGetError || !authData?.user) {
      return NextResponse.json(
        { error: "Target admin account not found" },
        { status: 404 },
      );
    }

    const targetUser = authData.user;
    const targetEmail = targetUser.email ?? "";
    const targetRole =
      (targetUser.user_metadata?.role as string | undefined) ??
      (targetUser.app_metadata?.role as string | undefined) ??
      ROLE.ADMIN;

    const allowed = canManageAdminAccount({
      targetEmail,
      targetRole,
      actorEmail: user.email,
      action: "edit",
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to edit this admin account" },
        { status: 403 },
      );
    }

    // Update profiles table
    try {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          email: email.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profileId);
    } catch (profileErr) {
      console.warn("Could not update profile table:", profileErr);
    }

    // Update Supabase Auth user
    const updatePayload: {
      email?: string;
      password?: string;
      user_metadata: Record<string, unknown>;
    } = {
      email: email.trim(),
      user_metadata: {
        ...targetUser.user_metadata,
        full_name: fullName.trim(),
        name: fullName.trim(),
      },
    };

    if (password && typeof password === "string" && password.trim().length >= 8) {
      updatePayload.password = password.trim();
    }

    const { error: updateError } =
      await supabase.auth.admin.updateUserById(profileId, updatePayload);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update admin account" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      details: {
        id: profileId,
        profile_id: profileId,
        full_name: fullName.trim(),
        email: email.trim(),
        role: targetRole,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update admin account", details: String(error) },
      { status: 500 },
    );
  }
}
