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

    const body = (await request.json().catch(() => ({}))) as {
      facultyProfileId?: string;
      profileId?: string;
      userId?: string;
      facultyId?: string;
      id?: string;
    };

    const targetIdentifier =
      body.facultyProfileId ||
      body.profileId ||
      body.id ||
      body.facultyId ||
      body.userId;

    if (!targetIdentifier) {
      return NextResponse.json(
        { error: "Faculty profile ID or user ID is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Resolve user_id and profile_id for the target user
    let profileId: string | null = null;
    let userId: string | null = null;
    let targetEmail: string | null = null;
    let targetFullName: string | null = null;

    // Check by profile id
    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, user_id, email, full_name")
      .eq("id", targetIdentifier)
      .maybeSingle();

    if (profileById) {
      profileId = profileById.id;
      userId = profileById.user_id ?? null;
      targetEmail = profileById.email ?? null;
      targetFullName = profileById.full_name ?? null;
    } else {
      // Check by user_id
      const { data: profileByUserId } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name")
        .eq("user_id", targetIdentifier)
        .maybeSingle();

      if (profileByUserId) {
        profileId = profileByUserId.id;
        userId = profileByUserId.user_id ?? targetIdentifier;
        targetEmail = profileByUserId.email ?? null;
        targetFullName = profileByUserId.full_name ?? null;
      } else {
        // Fallback: Check if targetIdentifier is an Auth user ID
        try {
          const { data: authUserData } =
            await supabase.auth.admin.getUserById(targetIdentifier);
          if (authUserData?.user) {
            userId = authUserData.user.id;
            targetEmail = authUserData.user.email ?? null;
            targetFullName =
              (authUserData.user.user_metadata?.full_name as string | undefined) ??
              null;
          }
        } catch {
          // Ignore auth lookup failure
        }
      }
    }

    if (!profileId && !userId) {
      return NextResponse.json(
        { error: `Faculty account not found with ID: ${targetIdentifier}` },
        { status: 404 },
      );
    }

    // 2. Remove entries from user_roles and faculty_program_assignments (and cascading records)
    if (profileId) {
      // Cascading deletion of submissions & related document versions / review decisions
      const { data: userSubmissions } = await supabase
        .from("submissions")
        .select("id")
        .eq("faculty_profile_id", profileId);

      if (userSubmissions && userSubmissions.length > 0) {
        const submissionIds = userSubmissions.map((s) => s.id);

        try {
          await supabase
            .from("document_versions")
            .delete()
            .in("submission_id", submissionIds);
        } catch {
          // Continue cleanup
        }

        try {
          await supabase
            .from("review_decisions")
            .delete()
            .in("submission_id", submissionIds);
        } catch {
          // Continue cleanup
        }

        const { error: subDeleteErr } = await supabase
          .from("submissions")
          .delete()
          .eq("faculty_profile_id", profileId);

        if (subDeleteErr) {
          logger.error("faculty_delete_submissions_failed", {
            profileId,
            error: subDeleteErr.message,
          });
        }
      }

      // Delete faculty_program_assignments
      try {
        await supabase
          .from("faculty_program_assignments")
          .delete()
          .eq("faculty_profile_id", profileId);
      } catch {
        // Continue cleanup
      }

      // Delete user_roles
      try {
        await supabase
          .from("user_roles")
          .delete()
          .eq("profile_id", profileId);
      } catch {
        // Continue cleanup
      }

      // Delete faculty table record
      try {
        await supabase
          .from("faculty")
          .delete()
          .eq("profile_id", profileId);
      } catch {
        // Continue cleanup
      }
    }

    // Delete user notifications if auth user ID is known
    if (userId) {
      try {
        await supabase
          .from("notifications")
          .delete()
          .eq("user_id", userId);
      } catch {
        // Continue cleanup
      }
    }

    // 3. Delete the profile from public.profiles
    if (profileId) {
      const { error: profileDeleteError } = await supabase
        .from("profiles")
        .delete()
        .eq("id", profileId);

      if (profileDeleteError) {
        return NextResponse.json(
          {
            error: `Failed to delete profile: ${profileDeleteError.message}`,
          },
          { status: 400 },
        );
      }
    }

    // 4. Delete the authentication account via Supabase Auth Admin API
    if (userId) {
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (authErr) {
        logger.error("faculty_delete_auth_user_failed", {
          userId,
          error: authErr instanceof Error ? authErr.message : String(authErr),
        });
      }
    }

    // 5. Record Audit Log
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "user.delete",
        entityType: "faculty",
        entityId: profileId || userId || targetIdentifier,
        metadata: {
          target_auth_user_id: userId,
          target_profile_id: profileId,
          target_email: targetEmail,
          target_full_name: targetFullName,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_delete_failed", {
        targetIdentifier,
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
