import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { isValidEmailAddress } from "@/lib/validation/email";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    const requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    if (
      !user ||
      (requesterRole !== ROLE.ADMIN && requesterRole !== ROLE.SUPER_ADMIN)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { fullName, email, password } = await request.json();

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmailAddress(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please provide a real email address" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Check if email already exists in profiles
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", normalizedEmail)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        {
          error: `Faculty account with email ${normalizedEmail} already exists`,
        },
        { status: 400 },
      );
    }

    // Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: "faculty",
        },
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message || "Failed to create auth user" },
        { status: 400 },
      );
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      user_id: authData.user.id,
      full_name: fullName,
      email: normalizedEmail,
    });

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 },
      );
    }

    // Get profile
    const { data: profile, error: profileSelectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", authData.user.id)
      .single();

    if (profileSelectError || !profile) {
      return NextResponse.json(
        { error: "Failed to retrieve created profile" },
        { status: 400 },
      );
    }

    const profileId = profile.id;

    // Assign faculty role
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .single();

    if (rolesError || !roles) {
      return NextResponse.json(
        { error: "Failed to find faculty role" },
        { status: 400 },
      );
    }

    const { error: roleAssignError } = await supabase
      .from("user_roles")
      .insert({
        profile_id: profileId,
        role_id: roles.id,
      });

    if (roleAssignError) {
      return NextResponse.json(
        { error: roleAssignError.message },
        { status: 400 },
      );
    }

    // Add to app_users table for visibility (use auth_user_id and profile_id)
    const { error: appUsersError } = await supabase.from("app_users").insert({
      auth_user_id: authData.user.id,
      profile_id: profileId,
      email: normalizedEmail,
      full_name: fullName,
      role: "faculty",
      metadata: {
        is_active: true,
        created_via: "admin_faculty_panel",
        created_by_admin_id: user.id,
      },
      created_at: new Date().toISOString(),
    });

    if (appUsersError) {
      return NextResponse.json(
        { error: appUsersError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
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
