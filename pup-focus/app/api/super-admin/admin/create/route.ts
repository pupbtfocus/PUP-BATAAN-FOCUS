import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
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
    const { fullName, email, password } = await request.json();

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return NextResponse.json(
        { error: `Account with email ${email} already exists` },
        { status: 400 },
      );
    }

    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: ROLE.ADMIN,
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Failed to create auth user" },
        { status: 400 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        user_id: authData.user.id,
        full_name: fullName,
        email,
      })
      .select("id")
      .single();

    if (profileError || !profile) {
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: profileError?.message ?? "Failed to create profile" },
        { status: 400 },
      );
    }

    const { data: adminRole, error: adminRoleError } = await supabase
      .from("roles")
      .select("id")
      .eq("code", ROLE.ADMIN)
      .single();

    if (adminRoleError || !adminRole) {
      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Admin role not found. Seed roles first." },
        { status: 400 },
      );
    }

    const { error: userRoleError } = await supabase.from("user_roles").insert({
      profile_id: profile.id,
      role_id: adminRole.id,
    });

    if (userRoleError) {
      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: userRoleError.message },
        { status: 400 },
      );
    }

    const { error: appUsersError } = await supabase.from("app_users").insert({
      auth_user_id: authData.user.id,
      profile_id: profile.id,
      email,
      full_name: fullName,
      role: ROLE.ADMIN,
    });

    if (appUsersError) {
      await supabase.from("profiles").delete().eq("id", profile.id);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: appUsersError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        fullName,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
