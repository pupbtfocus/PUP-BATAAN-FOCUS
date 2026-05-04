import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: NextRequest) {
  try {
    // Authenticate faculty user
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getServiceRoleClient();

    // Get faculty profile ID
    const { data: appUser } = await supabase
      .from("app_users")
      .select("profile_id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (!appUser) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    // Get all submissions for this faculty
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("id, requirement_code, status, faculty_profile_id, submitted_at")
      .eq("faculty_profile_id", appUser.profile_id);

    // Get total submissions in database for debugging
    const { data: allSubmissions, error: allError } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status")
      .limit(20);

    return NextResponse.json({
      currentUser: {
        authUserId: user.id,
        profileId: appUser.profile_id,
        role: appUser.role,
        email: user.email,
      },
      facultySubmissions: {
        count: submissions?.length || 0,
        submissions: submissions || [],
        error: submissionsError?.message,
      },
      sampleAllSubmissions: {
        count: allSubmissions?.length || 0,
        submissions: allSubmissions?.slice(0, 10) || [],
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
