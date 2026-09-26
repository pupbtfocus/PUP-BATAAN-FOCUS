export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse, type NextRequest } from "next/server";
import { ROLE, canManageAdminAccount } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

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
        .select("id, full_name, email")
        .eq("id", profileId)
        .maybeSingle();
      profile = data;
    } catch {}

    const authRes = await supabase.auth.admin.getUserById(profileId);
    const authUser = authRes.data?.user;

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
    const avatarUrl =
      authUser?.user_metadata?.avatar_url ||
      authUser?.user_metadata?.picture ||
      null;
    let resolvedAvatarUrl = avatarUrl;
    if (resolvedAvatarUrl && !resolvedAvatarUrl.startsWith("http")) {
      let cleanPath = resolvedAvatarUrl.replace(/^avatars\//, "");
      if (cleanPath.includes("/avatars/")) {
        cleanPath = cleanPath.split("/avatars/")[1].split("?")[0];
      }
      const { data: pub } = supabase.storage
        .from("avatars")
        .getPublicUrl(cleanPath);
      if (pub?.publicUrl) {
        resolvedAvatarUrl = pub.publicUrl;
      }
    }

    const isActive =
      profile?.status === "active" ||
      profile?.status === "true" ||
      authUser?.user_metadata?.is_active !== false;

    return NextResponse.json({
      details: {
        id: profileId,
        profile_id: profileId,
        full_name: fullName,
        email,
        role,
        department: "Administration",
        permissions: [],
        is_active: isActive,
        created_at: profile?.created_at || authUser?.created_at,
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
