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

    // Activate the faculty account (soft delete - set is_active to true)
    const { error: updateError } = await supabase
      .from("app_users")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("id", facultyProfileId);

    if (updateError) {
      console.error("Error activating faculty:", updateError);
      return NextResponse.json(
        { error: "Failed to activate faculty account" },
        { status: 500 },
      );
    }

    // Also update the faculty table if it exists
    await supabase
      .from("faculty")
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq("user_id", facultyProfileId);

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
