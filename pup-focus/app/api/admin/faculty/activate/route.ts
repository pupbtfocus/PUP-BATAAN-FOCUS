import { NextRequest, NextResponse } from "next/server";
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

    let existingMetadata: Record<string, unknown> = {};
    if (profile.user_id) {
      const { data: authUserData } = await supabase.auth.admin.getUserById(
        profile.user_id,
      );
      existingMetadata = (authUserData?.user?.user_metadata ??
        {}) as Record<string, unknown>;

      if (
        existingMetadata.created_via === "admin_faculty_panel" &&
        requesterRole === ROLE.ADMIN &&
        existingMetadata.created_by_admin_id !== user.id
      ) {
        return NextResponse.json(
          { error: "You can only modify faculty accounts you created" },
          { status: 403 },
        );
      }

      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(profile.user_id, {
          user_metadata: { ...existingMetadata, is_active: true },
        });

      if (authUpdateError) {
        console.error(
          "Error updating auth user metadata:",
          authUpdateError,
        );
        return NextResponse.json(
          { error: "Failed to activate faculty account" },
          { status: 500 },
        );
      }
    }

    // Audit log – fire-and-forget; never blocks the activation response
    try {
      await logAuditEvent({
        actorId: user.id,
        action: "user.activate",
        entityType: "faculty",
        entityId: facultyProfileId,
        metadata: {
          target_email: profile.email,
          target_full_name: profile.full_name,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_activate_failed", {
        facultyProfileId,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
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
