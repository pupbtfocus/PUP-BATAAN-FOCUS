import { NextRequest, NextResponse } from "next/server";
import { ROLE, resolveTrustedUserRole } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { logger } from "@/lib/observability/logger";
import { clearLoginLockout } from "@/lib/auth/login-attempts";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    let requesterRole =
      resolveTrustedUserRole(user);

    const supabase = getServiceRoleClient();

    const isAllowedRole = (r?: string) => {
      const normalized = (r ?? "").toLowerCase().trim();
      return (
        normalized === ROLE.STAFF ||
        normalized === ROLE.ADMIN ||
        normalized === ROLE.SUPER_ADMIN ||
        normalized === "staff" ||
        normalized === "super_admin" ||
        normalized === "superadmin"
      );
    };

    if (user && !isAllowedRole(requesterRole)) {
      const { data: profileRec } = await supabase
        .from("profiles")
        .select("id, user_roles(roles(code))")
        .eq("user_id", user.id)
        .maybeSingle();

      const dbRoleCode = (
        profileRec?.user_roles as
          | Array<{ roles: { code: string } | null }>
          | undefined
      )?.[0]?.roles?.code;
      if (isAllowedRole(dbRoleCode)) {
        requesterRole = dbRoleCode;
      }
    }

    if (!user || !isAllowedRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { facultyProfileId } = await request.json().catch(() => ({}));

    if (!facultyProfileId) {
      return NextResponse.json(
        { error: "Faculty profile ID is required" },
        { status: 400 },
      );
    }

    const { data: facultyRole, error: facultyRoleError } = await supabase
      .from("roles")
      .select("id")
      .eq("code", "faculty")
      .maybeSingle();

    if (facultyRoleError || !facultyRole?.id) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    const { data: roleAssignment } = await supabase
      .from("user_roles")
      .select("profile_id")
      .eq("profile_id", facultyProfileId)
      .eq("role_id", facultyRole.id)
      .maybeSingle();

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

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "Faculty account not found" },
        { status: 404 },
      );
    }

    let authUserId: string | null = profile.user_id ?? null;
    let authUserEmail: string | null = profile.email ?? null;
    let existingMetadata: Record<string, unknown> = {};

    if (authUserId) {
      const { data: authUserData } = await supabase.auth.admin
        .getUserById(authUserId)
        .catch(() => ({ data: null }));
      if (authUserData?.user) {
        authUserEmail = authUserData.user.email ?? authUserEmail;
        existingMetadata = (authUserData.user.user_metadata ??
          {}) as Record<string, unknown>;
      }
    } else if (profile.email) {
      const { data: usersData } = await supabase.auth.admin.listUsers({
        perPage: 1000,
      });
      const matched = (usersData?.users ?? []).find(
        (u) =>
          (u.email || "").toLowerCase().trim() ===
          profile.email.toLowerCase().trim(),
      );
      if (matched) {
        authUserId = matched.id;
        authUserEmail = matched.email ?? authUserEmail;
        existingMetadata = (matched.user_metadata ?? {}) as Record<
          string,
          unknown
        >;
      }
    }

    if (authUserId) {
      const { error: authUpdateError } =
        await supabase.auth.admin.updateUserById(authUserId, {
          user_metadata: {
            ...existingMetadata,
            failed_attempts: 0,
            locked_until: null,
          },
        });

      if (authUpdateError) {
        console.error(
          "Error unlocking faculty auth metadata:",
          authUpdateError,
        );
        return NextResponse.json(
          { error: "Failed to unlock faculty account" },
          { status: 500 },
        );
      }
    }

    clearLoginLockout(profile.email);
    if (authUserEmail && authUserEmail !== profile.email) {
      clearLoginLockout(authUserEmail);
    }

    try {
      await logAuditEvent({
        actorId: user.id,
        action: "user.unlock",
        entityType: "faculty",
        entityId: facultyProfileId,
        metadata: {
          target_email: profile.email,
          target_full_name: profile.full_name,
        },
      });
    } catch (auditError) {
      logger.error("audit_log_faculty_unlock_failed", {
        facultyProfileId,
        error:
          auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Faculty account unlocked. They can now sign in immediately.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in unlock faculty endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
