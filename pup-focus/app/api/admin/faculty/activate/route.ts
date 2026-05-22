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

    // Fetch existing metadata then set is_active: true
    const { data: appUser, error: fetchError } = await supabase
      .from("app_users")
      .select("id, auth_user_id, profile_id, metadata")
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
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    if (appUser.metadata?.created_via !== "admin_faculty_panel") {
      return NextResponse.json(
        { error: "Only faculty created from the admin panel can be modified" },
        { status: 403 },
      );
    }

    if (
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

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", facultyProfileId);

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
