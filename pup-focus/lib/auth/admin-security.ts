import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  ROLE,
  isAdminRoleToken,
  isOriginalAdmin,
  isQaAdmin,
} from "@/config/roles";
import { filterCondition, orFilter } from "@/lib/supabase/filters";

/**
 * Resolves a Supabase Auth user by email using an indexed `profiles` lookup first
 * and falling back to paginated auth admin listing if no profile row matches.
 */
export async function findAuthUserByEmail(
  serviceClient: SupabaseClient,
  email: string,
): Promise<User | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("user_id")
      .ilike("email", normalized)
      .maybeSingle();

    if (profile?.user_id) {
      const { data: byIdData } = await serviceClient.auth.admin.getUserById(
        profile.user_id,
      );
      if (
        byIdData?.user &&
        (byIdData.user.email || "").trim().toLowerCase() === normalized
      ) {
        return byIdData.user;
      }
    }
  } catch {
    // Fallback to paginated auth listing below
  }

  try {
    let page = 1;
    const perPage = 1000;
    while (page <= 10) {
      const { data: listData, error } =
        await serviceClient.auth.admin.listUsers({ page, perPage });
      if (error || !listData?.users?.length) break;

      const match = listData.users.find(
        (u) => (u.email || "").trim().toLowerCase() === normalized,
      );
      if (match) return match;

      if (listData.users.length < perPage) break;
      page++;
    }
  } catch {
    // Safe fallback
  }

  return null;
}

/**
 * Resolves the authoritative system role from DB records and server-side app_metadata,
 * ensuring legacy users receive immutable `app_metadata.role` on login.
 */
export async function syncTrustedAppMetadataRole(
  serviceClient: SupabaseClient,
  user: User,
): Promise<string> {
  const email = (user.email || "").trim().toLowerCase();
  const currentAppMeta = (user.app_metadata ?? {}) as Record<string, unknown>;
  const existingAppRole =
    typeof currentAppMeta.role === "string"
      ? currentAppMeta.role.trim().toLowerCase()
      : "";

  let resolvedRole: string | null = null;

  if (isOriginalAdmin(email) || isQaAdmin(email)) {
    resolvedRole = ROLE.ADMIN;
  } else if (
    existingAppRole === ROLE.STAFF ||
    existingAppRole === ROLE.FACULTY ||
    existingAppRole === ROLE.ADMIN
  ) {
    resolvedRole = existingAppRole;
  } else {
    try {
      const { data: profile } = await serviceClient
        .from("profiles")
        .select("id, user_roles(roles(code))")
        .or(
          orFilter([
            filterCondition("user_id", "eq", user.id),
            filterCondition("id", "eq", user.id),
            ...(email ? [filterCondition("email", "eq", email)] : []),
          ]),
        )
        .maybeSingle();

      const userRoles = profile?.user_roles as
        | Array<{ roles: { code: string } | null }>
        | undefined;
      const dbRoleCode = userRoles?.[0]?.roles?.code?.toLowerCase().trim();

      if (dbRoleCode && !isAdminRoleToken(dbRoleCode)) {
        resolvedRole = dbRoleCode;
      } else {
        const { data: staffRow } = await serviceClient
          .from("staff")
          .select("id")
          .ilike("email", email)
          .maybeSingle();

        if (staffRow?.id) {
          resolvedRole = ROLE.STAFF;
        }
      }
    } catch {
      // Fallback below
    }

    if (!resolvedRole) {
      const legacyMetaRole =
        typeof user.user_metadata?.role === "string"
          ? user.user_metadata.role.trim().toLowerCase()
          : "";
      resolvedRole =
        legacyMetaRole === ROLE.STAFF || legacyMetaRole === "staff"
          ? ROLE.STAFF
          : ROLE.FACULTY;
    }
  }

  const nextAppMeta: Record<string, unknown> = {
    ...currentAppMeta,
    role: resolvedRole,
    ...(isOriginalAdmin(email) ? { is_primary_admin: true } : {}),
  };

  const needsUpdate =
    existingAppRole !== resolvedRole ||
    (isOriginalAdmin(email) && currentAppMeta.is_primary_admin !== true);

  if (needsUpdate) {
    try {
      await serviceClient.auth.admin.updateUserById(user.id, {
        app_metadata: nextAppMeta,
      });
    } catch {
      // Non-fatal; caller still proceeds with login
    }
  }

  return resolvedRole;
}

/**
 * Enforces TOTP MFA (`aal2`) whenever the user already has at least one verified MFA factor
 * (`nextLevel === "aal2"`). If the user has not enrolled MFA yet (`nextLevel !== "aal2"`),
 * access remains allowed so they can enroll in Settings without locking themselves out.
 */
export async function verifyMfaAal2IfEnrolled(
  sessionClient: SupabaseClient,
  options?: { user?: User | null; bearerToken?: string | null },
): Promise<{ ok: boolean; currentLevel: string | null; nextLevel: string | null }> {
  try {
    if (options?.bearerToken && options.user) {
      const hasVerifiedFactor = Boolean(
        options.user.factors?.some((f) => f.status === "verified"),
      );
      if (!hasVerifiedFactor) {
        return { ok: true, currentLevel: "aal1", nextLevel: "aal1" };
      }
      const parts = options.bearerToken.split(".");
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
        const payload = JSON.parse(payloadJson) as { aal?: string };
        const aal = payload.aal ?? null;
        return { ok: aal === "aal2", currentLevel: aal, nextLevel: "aal2" };
      }
    }

    const { data, error } =
      await sessionClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) {
      return { ok: true, currentLevel: null, nextLevel: null };
    }

    const currentLevel = data.currentLevel ?? null;
    const nextLevel = data.nextLevel ?? null;

    if (nextLevel === "aal2" && currentLevel !== "aal2") {
      return { ok: false, currentLevel, nextLevel };
    }

    return { ok: true, currentLevel, nextLevel };
  } catch {
    return { ok: true, currentLevel: null, nextLevel: null };
  }
}
