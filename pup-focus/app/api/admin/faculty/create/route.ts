import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, password, programCode } = await request.json();

    if (!fullName || !email || !password || !programCode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Check if email already exists in profiles
    const { data: existingProfile, error: checkError } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: `Faculty account with email ${email} already exists` },
        { status: 400 },
      );
    }

    // Create auth user
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
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
      email,
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

    // Get program info
    const { data: program, error: programError } = await supabase
      .from("programs")
      .select("id, code, name")
      .eq("code", programCode)
      .single();

    if (programError || !program) {
      return NextResponse.json(
        { error: "Invalid program code" },
        { status: 400 },
      );
    }

    // Create faculty program assignment
    const currentYear = new Date().getFullYear().toString();
    const { error: assignmentError } = await supabase
      .from("faculty_program_assignments")
      .insert({
        faculty_profile_id: profileId,
        program_id: program.id,
        academic_year: currentYear,
        term: "1",
      });

    if (assignmentError) {
      return NextResponse.json(
        { error: assignmentError.message },
        { status: 400 },
      );
    }

    // Add to app_users table for visibility
    const { error: appUsersError } = await supabase.from("app_users").insert({
      auth_user_id: authData.user.id,
      profile_id: profileId,
      email,
      full_name: fullName,
      role: "faculty",
      program_id: program.id,
      program_code: program.code,
      program_name: program.name,
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
        programCode,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 },
    );
  }
}
