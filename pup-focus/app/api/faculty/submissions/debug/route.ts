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

    // Get faculty profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_roles(roles(code))")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      return NextResponse.json(
        { error: "Faculty profile not found" },
        { status: 404 },
      );
    }

    const rolesList = ((profile.user_roles as any[]) || []).map(
      (ur) => ur.roles?.code,
    );

    // Get all submissions for this faculty
    const { data: submissions, error: submissionsError } = await supabase
      .from("submissions")
      .select("id, requirement_code, status, faculty_profile_id, submitted_at")
      .eq("faculty_profile_id", profile.id);

    // Get total submissions in database for debugging
    const { data: allSubmissions, error: allError } = await supabase
      .from("submissions")
      .select("id, faculty_profile_id, requirement_code, status")
      .limit(20);

    return NextResponse.json({
      currentUser: {
        authUserId: user.id,
        profileId: profile.id,
        role: rolesList.join(", ") || "faculty",
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
