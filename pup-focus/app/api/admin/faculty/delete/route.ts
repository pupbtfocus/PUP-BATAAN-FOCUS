import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";

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

    const { facultyProfileId } = (await request.json()) as {
      facultyProfileId?: string;
    };

    if (!facultyProfileId) {
      return NextResponse.json(
        { error: "Faculty profile ID is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Fetch profile information
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name")
      .eq("id", facultyProfileId)
      .maybeSingle();

    // 2. Fetch app_users record (for auth_user_id or orphan handling)
    const { data: appUser } = await supabase
      .from("app_users")
      .select("id, auth_user_id, profile_id, role")
      .eq("profile_id", facultyProfileId)
      .maybeSingle();

    const authUserId = profile?.user_id || appUser?.auth_user_id;

    if (!profile && !appUser) {
      return NextResponse.json(
        { error: `Faculty account not found with ID: ${facultyProfileId}` },
        { status: 404 },
      );
    }

    // Step 3: Cascading deletion of submissions & related document versions / review decisions
    const { data: userSubmissions } = await supabase
      .from("submissions")
      .select("id")
      .eq("faculty_profile_id", facultyProfileId);

    if (userSubmissions && userSubmissions.length > 0) {
      const submissionIds = userSubmissions.map((s) => s.id);

      // Delete document_versions
      try {
        await supabase
          .from("document_versions")
          .delete()
          .in("submission_id", submissionIds);
      } catch {
        // Continue cleanup
      }

      // Delete review_decisions
      try {
        await supabase
          .from("review_decisions")
          .delete()
          .in("submission_id", submissionIds);
      } catch {
        // Continue cleanup
      }

      // Delete submissions
      const { error: subDeleteErr } = await supabase
        .from("submissions")
        .delete()
        .eq("faculty_profile_id", facultyProfileId);

      if (subDeleteErr) {
        logger.error("faculty_delete_submissions_failed", {
          facultyProfileId,
          error: subDeleteErr.message,
        });
      }
    }

    // Step 4: Delete faculty_program_assignments
    try {
      await supabase
        .from("faculty_program_assignments")
        .delete()
        .eq("faculty_profile_id", facultyProfileId);
    } catch {
      // Continue cleanup
    }

    // Step 5: Delete user_roles
    try {
      await supabase
        .from("user_roles")
        .delete()
        .eq("profile_id", facultyProfileId);
    } catch {
      // Continue cleanup
    }

    // Step 6: Delete faculty table record
    try {
      await supabase
        .from("faculty")
        .delete()
        .eq("profile_id", facultyProfileId);
    } catch {
      // Continue cleanup
    }

    // Step 7: Delete notifications (if authUserId is present)
    if (authUserId) {
      try {
        await supabase
          .from("notifications")
          .delete()
          .eq("user_id", authUserId);
      } catch {
        // Continue cleanup
      }
    }

    // Step 8: Delete app_users record
    try {
      await supabase
        .from("app_users")
        .delete()
        .or(
          `profile_id.eq.${facultyProfileId}${authUserId ? `,auth_user_id.eq.${authUserId}` : ""}`,
        );
    } catch {
      // Continue cleanup
    }

    // Step 9: Delete profile record
    if (profile?.id) {
      const { error: profileDeleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", facultyProfileId);

      if (profileDeleteError) {
        return NextResponse.json(
          {
            error: `Failed to delete profile: ${profileDeleteError.message}`,
          },
          { status: 400 },
        );
      }
    }

    // Step 10: Delete Supabase Auth User
    if (authUserId) {
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (authErr) {
        logger.error("faculty_delete_auth_user_failed", {
          authUserId,
          error: authErr instanceof Error ? authErr.message : String(authErr),
        });
      }
    }

    // Step 11: Record Audit Log
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "user.delete",
        entityType: "faculty",
        entityId: facultyProfileId,
        metadata: {
          target_auth_user_id: authUserId ?? null,
          target_email: profile?.email ?? null,
          target_full_name: profile?.full_name ?? null,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_delete_failed", {
        facultyProfileId,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    return NextResponse.json({
      success: true,
      message: "Faculty account and all associated data deleted successfully.",
    });
  } catch (error) {
    logger.error("faculty_delete_unexpected_exception", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        error: `Database error deleting user: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 500 },
    );
  }
}
