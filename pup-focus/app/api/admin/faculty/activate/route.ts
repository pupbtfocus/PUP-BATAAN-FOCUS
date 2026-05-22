import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";

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

    const { facultyProfileId } = await request.json();

    if (!facultyProfileId) {
      return NextResponse.json(
        { error: "Faculty profile ID is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    const { data: facultyRole, error: facultyRoleError } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    if (facultyRoleError) {
      console.error(
        "Error fetching faculty role before activation:",
        facultyRoleError,
      );
      return NextResponse.json(
        { error: "Failed to fetch faculty account" },
        { status: 500 },
      );
    }

    if (!facultyRole?.id) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    const { data: roleAssignment, error: roleAssignmentError } = await supabase
      .from("user_roles")
      .select("profile_id")
      .eq("profile_id", facultyProfileId)
      .eq("role_id", facultyRole.id)
      .maybeSingle();

    if (roleAssignmentError) {
      console.error(
        "Error fetching faculty role assignment before activation:",
        roleAssignmentError,
      );
      return NextResponse.json(
        { error: "Failed to fetch faculty account" },
        { status: 500 },
      );
    }

    if (!roleAssignment) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, full_name, email")
      .eq("id", facultyProfileId)
      .maybeSingle();

    if (profileError) {
      console.error("Error fetching profile before activation:", profileError);
      return NextResponse.json(
        { error: "Failed to fetch faculty account" },
        { status: 500 },
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    const { data: appUser, error: fetchError } = await supabase
      .from("app_users")
      .select("id, auth_user_id, profile_id, metadata, created_at")
      .eq("profile_id", facultyProfileId)
      .eq("role", "faculty")
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching app_user before activation:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch faculty account" },
        { status: 500 },
      );
    }

    if (!appUser) {
      // Legacy accounts may not have an app_users row yet; create one on first toggle.
    }

    if (
      appUser?.metadata?.created_via === "admin_faculty_panel" &&
      requesterRole === ROLE.ADMIN &&
      appUser.metadata?.created_by_admin_id !== user.id
    ) {
      return NextResponse.json(
        { error: "You can only modify faculty accounts you created" },
        { status: 403 },
      );
    }

    const existingMetadata = appUser?.metadata ?? {};
    const updatedMetadata = { ...existingMetadata, is_active: true };

    const payload = {
      auth_user_id: appUser?.auth_user_id ?? profile.user_id,
      profile_id: facultyProfileId,
      full_name: profile.full_name,
      email: profile.email,
      role: "faculty",
      metadata: updatedMetadata,
      updated_at: new Date().toISOString(),
    };

    const updateResult = appUser
      ? await supabase.from("app_users").update(payload).eq("id", appUser.id)
      : await supabase.from("app_users").insert({
          ...payload,
          created_at: new Date().toISOString(),
        });

    const updateError = updateResult.error;

    if (updateError) {
      console.error("Error updating app_users metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to activate faculty account" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Faculty account activated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in activate endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
