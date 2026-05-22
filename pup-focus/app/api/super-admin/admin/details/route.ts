import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
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

  if (!user || requesterRole !== ROLE.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const profileId = new URL(request.url).searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = getServiceRoleClient();

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select(
        "auth_user_id, profile_id, role, metadata, created_at, updated_at",
      )
      .eq("profile_id", profileId)
      .in("role", [ROLE.ADMIN, ROLE.SUPER_ADMIN])
      .maybeSingle();

    if (appUserError || !appUser) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select(
        "id, profile_id, full_name, email, department, permissions, is_active, created_at, updated_at",
      )
      .eq("profile_id", profileId)
      .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "Admin details not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      details: {
        ...admin,
        auth_user_id: appUser.auth_user_id,
        role: appUser.role,
        metadata: appUser.metadata ?? {},
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

  if (!user || requesterRole !== ROLE.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const payload = (await request.json()) as {
      profileId?: string;
      fullName?: string;
      email?: string;
      password?: string;
    };

    const profileId = payload.profileId?.trim();
    const fullName = payload.fullName?.trim();
    const email = payload.email?.trim().toLowerCase();
    const password = payload.password?.trim();

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "Full name and email are required" },
        { status: 400 },
      );
    }

    if (password && password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select("auth_user_id, profile_id, role, metadata")
      .eq("profile_id", profileId)
      .eq("role", ROLE.ADMIN)
      .maybeSingle();

    if (appUserError || !appUser) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select("id, profile_id, full_name, email")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "Admin details not found" },
        { status: 404 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .maybeSingle();

    const authUserId = appUser.auth_user_id ?? profile?.user_id;

    if (!authUserId) {
      return NextResponse.json(
        { error: "Unable to resolve admin auth user" },
        { status: 400 },
      );
    }

    const previousEmail = admin.email ?? email;
    const previousFullName = admin.full_name ?? fullName;

    const { data: duplicateProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", profileId)
      .maybeSingle();

    if (duplicateProfile) {
      return NextResponse.json(
        { error: `Another account already uses ${email}` },
        { status: 400 },
      );
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        email,
        password: password || undefined,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          full_name: fullName,
          role: ROLE.ADMIN,
        },
      },
    );

    if (authUpdateError) {
      return NextResponse.json(
        { error: authUpdateError.message },
        { status: 400 },
      );
    }

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({ full_name: fullName, email })
      .eq("id", profileId);

    if (profileUpdateError) {
      await supabase.auth.admin.updateUserById(authUserId, {
        email: previousEmail,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          full_name: previousFullName,
          role: ROLE.ADMIN,
        },
      });

      return NextResponse.json(
        { error: profileUpdateError.message },
        { status: 400 },
      );
    }

    const { error: appUsersUpdateError } = await supabase
      .from("app_users")
      .update({ full_name: fullName, email })
      .eq("profile_id", profileId)
      .eq("role", ROLE.ADMIN);

    if (appUsersUpdateError) {
      await supabase.auth.admin.updateUserById(authUserId, {
        email: previousEmail,
        email_confirm: true,
        user_metadata: {
          ...(user.user_metadata ?? {}),
          full_name: previousFullName,
          role: ROLE.ADMIN,
        },
      });

      return NextResponse.json(
        { error: appUsersUpdateError.message },
        { status: 400 },
      );
    }

    const { error: adminUpdateError } = await supabase
      .from("admins")
      .update({ full_name: fullName, email })
      .eq("profile_id", profileId);

    if (adminUpdateError) {
      return NextResponse.json(
        { error: adminUpdateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      details: {
        ...admin,
        full_name: fullName,
        email,
        auth_user_id: appUser.auth_user_id ?? null,
        role: ROLE.ADMIN,
        metadata: appUser.metadata ?? {},
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update admin details", details: String(error) },
      { status: 500 },
    );
  }
}
