import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  ROLE,
  isAdminRoleToken,
  isOriginalAdmin,
  resolveTrustedUserRole,
} from "@/config/roles";
import { verifyMfaAal2IfEnrolled } from "@/lib/auth/admin-security";
import { filterCondition, orFilter } from "@/lib/supabase/filters";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";

async function resolveTargetAuthUser(
  supabase: ReturnType<typeof getServiceRoleClient>,
  userIdOrProfileId: string,
) {
  const { data: directData } = await supabase.auth.admin
    .getUserById(userIdOrProfileId)
    .catch(() => ({ data: null }));

  if (directData?.user) {
    return directData.user;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .or(
      orFilter([
        filterCondition("id", "eq", userIdOrProfileId),
        filterCondition("user_id", "eq", userIdOrProfileId),
      ]),
    )
    .maybeSingle();

  if (profile?.user_id) {
    const { data: byProfile } = await supabase.auth.admin
      .getUserById(profile.user_id)
      .catch(() => ({ data: null }));
    if (byProfile?.user) {
      return byProfile.user;
    }
  }

  return null;
}

function canActorManageTargetMfa(params: {
  actorEmail?: string | null;
  actorRole?: string;
  targetEmail?: string | null;
  targetRole?: string;
}): { allowed: boolean; reason?: string } {
  const { actorEmail, actorRole, targetEmail, targetRole } = params;

  // Primary system administrator 2FA can never be reset via UI/API by anyone
  if (isOriginalAdmin(targetEmail)) {
    return {
      allowed: false,
      reason: "Primary Administrator 2FA cannot be reset by another user.",
    };
  }

  const actorIsAdmin =
    isOriginalAdmin(actorEmail) || isAdminRoleToken(actorRole);
  const actorIsStaff = actorRole === ROLE.STAFF || actorRole === "staff";

  if (actorIsAdmin) {
    return { allowed: true };
  }

  if (actorIsStaff) {
    const normalizedTargetRole = (targetRole || "").toLowerCase().trim();
    if (normalizedTargetRole === ROLE.FACULTY) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: "Staff can only reset 2FA for Faculty accounts.",
    };
  }

  return { allowed: false, reason: "Forbidden" };
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user: actor },
    } = await sessionClient.auth.getUser();

    const actorRole = resolveTrustedUserRole(actor);
    const isActorAdminOrStaff =
      isOriginalAdmin(actor?.email) ||
      isAdminRoleToken(actorRole) ||
      actorRole === ROLE.STAFF ||
      actorRole === "staff";

    if (!actor || !isActorAdminOrStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mfaCheck = await verifyMfaAal2IfEnrolled(sessionClient);
    if (!mfaCheck.ok) {
      return NextResponse.json(
        { error: "Two-factor authentication verification required." },
        { status: 403 },
      );
    }

    const rawTargetId = new URL(request.url).searchParams.get("userId")?.trim();
    if (!rawTargetId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const supabase = getServiceRoleClient();
    const targetUser = await resolveTargetAuthUser(supabase, rawTargetId);
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const targetRole = resolveTrustedUserRole(targetUser) ?? ROLE.FACULTY;
    const perm = canActorManageTargetMfa({
      actorEmail: actor.email,
      actorRole,
      targetEmail: targetUser.email,
      targetRole,
    });

    const { data: listData } = await supabase.auth.admin.mfa.listFactors({
      userId: targetUser.id,
    });
    const verifiedFactors = (listData?.factors ?? []).filter(
      (f) => f.status === "verified",
    );

    return NextResponse.json(
      {
        enabled: verifiedFactors.length > 0,
        factorCount: verifiedFactors.length,
        canReset: perm.allowed,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to inspect MFA status",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user: actor },
    } = await sessionClient.auth.getUser();

    const actorRole = resolveTrustedUserRole(actor);
    const isActorAdminOrStaff =
      isOriginalAdmin(actor?.email) ||
      isAdminRoleToken(actorRole) ||
      actorRole === ROLE.STAFF ||
      actorRole === "staff";

    if (!actor || !isActorAdminOrStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const mfaCheck = await verifyMfaAal2IfEnrolled(sessionClient);
    if (!mfaCheck.ok) {
      return NextResponse.json(
        { error: "Two-factor authentication verification required." },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawTargetId = String(body.userId || body.profileId || "").trim();
    if (!rawTargetId) {
      return NextResponse.json(
        { error: "userId or profileId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();
    const targetUser = await resolveTargetAuthUser(supabase, rawTargetId);
    if (!targetUser) {
      return NextResponse.json({ error: "Target user not found" }, { status: 404 });
    }

    const targetRole = resolveTrustedUserRole(targetUser) ?? ROLE.FACULTY;
    const perm = canActorManageTargetMfa({
      actorEmail: actor.email,
      actorRole,
      targetEmail: targetUser.email,
      targetRole,
    });

    if (!perm.allowed) {
      return NextResponse.json(
        { error: perm.reason || "Forbidden" },
        { status: 403 },
      );
    }

    const { data: listData, error: listErr } =
      await supabase.auth.admin.mfa.listFactors({ userId: targetUser.id });

    if (listErr) {
      return NextResponse.json({ error: listErr.message }, { status: 400 });
    }

    let removedCount = 0;
    for (const factor of listData?.factors ?? []) {
      const { error: delErr } = await supabase.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: targetUser.id,
      });
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 });
      }
      removedCount++;
    }

    const currentAppMeta = (targetUser.app_metadata ?? {}) as Record<
      string,
      unknown
    >;
    await supabase.auth.admin
      .updateUserById(targetUser.id, {
        app_metadata: {
          ...currentAppMeta,
          mfa_recovery_hashes: [],
          mfa_reset_by_admin_at: new Date().toISOString(),
        },
      })
      .catch(() => null);

    void logAuditEvent({
      actorId: actor.id,
      action: "user.mfa_reset",
      entityType: "user",
      entityId: targetUser.id,
      metadata: {
        targetEmail: targetUser.email,
        targetRole,
        removedFactors: removedCount,
      },
    });

    return NextResponse.json({
      success: true,
      removedFactors: removedCount,
      enabled: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reset user 2FA",
      },
      { status: 500 },
    );
  }
}
