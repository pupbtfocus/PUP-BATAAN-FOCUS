import { NextResponse, type NextRequest } from "next/server";
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
        "Error fetching faculty role before deletion:",
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
        "Error fetching faculty role assignment before deletion:",
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

    // Step 1: Check if there's an app_users record (even if profile doesn't exist)
    const { data: appUser } = await supabase
      .from("app_users")
      .select("id, auth_user_id, profile_id, role, metadata")
      .eq("profile_id", facultyProfileId)
      .maybeSingle();

    if (appUser?.role !== "faculty" && !appUser) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    if (
      appUser?.metadata?.created_via === "admin_faculty_panel" &&
      requesterRole === ROLE.ADMIN &&
      appUser.metadata?.created_by_admin_id !== user.id
    ) {
      return NextResponse.json(
        { error: "You can only delete faculty accounts you created" },
        { status: 403 },
      );
    }

    // Step 2: Get user_id from profile before deletion (needed for auth cleanup)
    const { data: profile, error: profileFetchError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", facultyProfileId)
      .maybeSingle();

    if (profileFetchError) {
      return NextResponse.json(
        { error: `Error fetching profile: ${profileFetchError.message}` },
        { status: 400 },
      );
    }
    // If profile exists, ensure there are no linked submissions or assignments.
    if (profile) {
      const [submissionsCountResult, assignmentsCountResult] =
        await Promise.all([
          supabase
            .from("submissions")
            .select("id", { head: true, count: "exact" })
            .eq("faculty_profile_id", facultyProfileId),
          supabase
            .from("faculty_program_assignments")
            .select("id", { head: true, count: "exact" })
            .eq("faculty_profile_id", facultyProfileId),
        ]);

      if (submissionsCountResult.error || assignmentsCountResult.error) {
        console.error(
          "Error checking related faculty records before deletion:",
          submissionsCountResult.error ?? assignmentsCountResult.error,
        );
        return NextResponse.json(
          {
            error:
              "Failed to verify faculty account dependencies before deletion.",
          },
          { status: 500 },
        );
      }

      const hasRelatedRecords =
        (submissionsCountResult.count ?? 0) > 0 ||
        (assignmentsCountResult.count ?? 0) > 0;

      if (hasRelatedRecords) {
        return NextResponse.json(
          {
            error:
              "Unable to Delete. This faculty member has existing requirement submissions or verification records. Please deactivate the account instead.",
          },
          { status: 400 },
        );
      }
    }
    // If profile doesn't exist but app_users record does, clean it up and consider it success
    if (!profile && appUser) {
      console.warn(
        `Profile not found but app_users record exists for profile ID: ${facultyProfileId}. Cleaning up orphaned record.`,
      );

      const { error: cleanupError } = await supabase
        .from("app_users")
        .delete()
        .eq("profile_id", facultyProfileId);

      if (cleanupError) {
        console.error(
          "Error cleaning up orphaned app_users record:",
          cleanupError,
        );
      }

      // Try to delete auth user if we have the ID
      if (appUser.auth_user_id) {
        try {
          await supabase.auth.admin.deleteUser(appUser.auth_user_id);
        } catch (authError) {
          console.error("Warning: Could not delete auth user:", authError);
        }
      }

      return NextResponse.json({
        success: true,
        message: "Cleaned up orphaned user record",
      });
    }

    if (!profile) {
      console.error(
        `Profile and app_users record not found for ID: ${facultyProfileId}`,
      );
      return NextResponse.json(
        { error: `User not found with ID: ${facultyProfileId}` },
        { status: 404 },
      );
    }

    // Step 2: Clean up app_users records first (no cascades on this)
    const { error: appUsersError } = await supabase
      .from("app_users")
      .delete()
      .or(
        `profile_id.eq.${facultyProfileId},auth_user_id.eq.${profile.user_id}`,
      );

    if (appUsersError) {
      console.error(
        "Warning: Could not delete app_users records:",
        appUsersError,
      );
      // Continue anyway - this shouldn't prevent profile deletion
    }

    // Step 3: Delete faculty_program_assignments (should cascade but delete explicitly for safety)
    const { error: assignmentsError } = await supabase
      .from("faculty_program_assignments")
      .delete()
      .eq("faculty_profile_id", facultyProfileId);

    if (assignmentsError) {
      return NextResponse.json(
        {
          error: `Failed to delete faculty assignments: ${assignmentsError.message}`,
        },
        { status: 400 },
      );
    }

    // Step 4: Delete user_roles (should cascade but delete explicitly for safety)
    const { error: rolesError } = await supabase
      .from("user_roles")
      .delete()
      .eq("profile_id", facultyProfileId);

    if (rolesError) {
      return NextResponse.json(
        { error: `Failed to delete user roles: ${rolesError.message}` },
        { status: 400 },
      );
    }

    // Step 5: Delete from faculty table (should cascade but delete explicitly for safety)
    const { error: facultyError } = await supabase
      .from("faculty")
      .delete()
      .eq("profile_id", facultyProfileId);

    if (facultyError) {
      console.error("Warning: Could not delete faculty record:", facultyError);
      // Continue anyway - faculty record might not exist
    }

    // Step 6: Finally delete the profile (this will cascade delete due to profile_user_id_fkey)
    const { error: profileDeleteError } = await supabase
      .from("profiles")
      .delete()
      .eq("id", facultyProfileId);

    if (profileDeleteError) {
      return NextResponse.json(
        { error: `Failed to delete profile: ${profileDeleteError.message}` },
        { status: 400 },
      );
    }

    // Step 7: Delete from Supabase Auth (if profile had an associated auth user)
    if (profile.user_id) {
      try {
        await supabase.auth.admin.deleteUser(profile.user_id);
      } catch (authError) {
        console.error("Warning: Could not delete auth user:", authError);
        // Continue - profile is already deleted
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error during faculty deletion:", error);
    return NextResponse.json(
      {
        error: `Database error deleting user: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
