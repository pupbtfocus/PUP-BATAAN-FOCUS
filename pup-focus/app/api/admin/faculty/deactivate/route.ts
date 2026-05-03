import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
  try {
    const { facultyProfileId } = await request.json();

    if (!facultyProfileId) {
      return NextResponse.json(
        { error: "Faculty profile ID is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Fetch the app_users row to obtain existing metadata
    const { data: appUser, error: fetchError } = await supabase
      .from("app_users")
      .select("id, auth_user_id, profile_id, metadata")
      .eq("id", facultyProfileId)
      .maybeSingle();

    if (fetchError) {
      console.error("Error fetching app_user before deactivation:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch faculty account" },
        { status: 500 },
      );
    }

    const existingMetadata = appUser?.metadata ?? {};
    const updatedMetadata = { ...existingMetadata, is_active: false };

    const { error: updateError } = await supabase
      .from("app_users")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", facultyProfileId);

    if (updateError) {
      console.error("Error updating app_users metadata:", updateError);
      return NextResponse.json(
        { error: "Failed to deactivate faculty account" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { success: true, message: "Faculty account deactivated successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in deactivate endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
