import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
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

    const url = new URL(request.url);
    const facultyId = url.searchParams.get("facultyId");

    if (!facultyId) {
      return NextResponse.json(
        { error: "facultyId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // Step 1: Look up app_user
    const { data: appUserRow, error: appUserError } = await supabase
      .from("app_users")
      .select("id, profile_id, role")
      .eq("id", facultyId)
      .maybeSingle();

    console.log("Step 1 - App User Lookup:", {
      facultyId,
      found: !!appUserRow,
      profile_id: appUserRow?.profile_id,
      role: appUserRow?.role,
      error: appUserError?.message,
    });

    if (!appUserRow?.profile_id) {
      return NextResponse.json({
        error: "Faculty profile not found",
        debug: {
          facultyId,
          appUserRow,
          appUserError,
        },
      });
    }

    const facultyProfileId = appUserRow.profile_id;

    // Step 2: Query all submissions for this profile
    const { data: submissionRows, error: submissionsError } = await supabase
      .from("submissions")
      .select("id, requirement_code, status, submitted_at")
      .eq("faculty_profile_id", facultyProfileId);

    console.log("Step 2 - Submissions Query:", {
      facultyProfileId,
      count: submissionRows?.length || 0,
      error: submissionsError?.message,
      submissions: submissionRows,
    });

    // Step 3: Also query the faculty list to see what's being returned
    const { data: facultyList, error: listError } = await supabase
      .from("app_users")
      .select("id, role, profile_id")
      .eq("role", "faculty")
      .limit(10);

    console.log("Step 3 - Faculty List:", {
      count: facultyList?.length || 0,
      error: listError?.message,
      roles: facultyList?.map((f: any) => f.role),
      appUserIds: facultyList?.map((f: any) => f.id),
    });

    return NextResponse.json({
      success: true,
      debug: {
        facultyId,
        facultyProfileId,
        appUser: appUserRow,
        submissionCount: submissionRows?.length || 0,
        submissions: submissionRows || [],
        queryError: submissionsError?.message,
        facultyListCount: facultyList?.length || 0,
        facultyListSample: facultyList || [],
      },
    });
  } catch (error) {
    return NextResponse.json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
