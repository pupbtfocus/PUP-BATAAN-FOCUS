import { after, NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile/verify";
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  clearPersistentLoginLockout,
  getLoginAttemptRecord,
  getPersistentLoginAttempt,
  persistLoginAttempt,
} from "@/lib/auth/login-attempts";
import {
  ROLE,
  isAdminRoleToken,
  isOriginalAdmin,
  isQaAdmin,
  resolveTrustedUserRole,
} from "@/config/roles";
import { setActiveSession } from "@/lib/auth/session-tracker";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

export async function GET(request: NextRequest) {
  try {
    const email = new URL(request.url).searchParams
      .get("email")
      ?.trim()
      .toLowerCase();
    if (!email) {
      return NextResponse.json(
        { isLocked: false, remainingSeconds: 0 },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const now = Date.now();
    const serviceClient = getServiceRoleClient();
    const { record } = await getPersistentLoginAttempt(serviceClient, email);
    const lockedUntil =
      record.lockedUntil && record.lockedUntil > now ? record.lockedUntil : 0;

    const isLocked = lockedUntil > now;
    const remainingSeconds = isLocked
      ? Math.ceil((lockedUntil - now) / 1000)
      : 0;

    return NextResponse.json(
      { isLocked, remainingSeconds },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { isLocked: false, remainingSeconds: 0 },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown> = {};

    if (
      contentType.includes("multipart/form-data") ||
      contentType.includes("application/x-www-form-urlencoded")
    ) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        body = Object.fromEntries(formData.entries());
      }
    } else {
      body = await request.json().catch(() => ({}));
    }

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const rememberMe =
      body.rememberMe === true ||
      body.rememberMe === "true" ||
      body.remember_me === true ||
      body.remember_me === "true";
    const token = extractTurnstileToken(body);

    if (!email || !password) {
      return NextResponse.json(
        {
          success: false,
          code: "invalid-credentials-payload",
          error: "Email and password are required.",
        },
        { status: 400 },
      );
    }

    const now = Date.now();
    const memoryAttempt = getLoginAttemptRecord(email);
    if (memoryAttempt?.lockedUntil && memoryAttempt.lockedUntil > now) {
      const remainingMins = Math.ceil((memoryAttempt.lockedUntil - now) / 60000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`,
        },
        { status: 429 },
      );
    }

    const serviceClient = getServiceRoleClient();

    // Wave 1 (parallel): Turnstile verification, account status/role lookups, and SSR cookie client setup
    const [turnstileCheck, profileRes, staffRes, adminRes, userClient] =
      await Promise.all([
        verifyTurnstileToken({
          token,
          expectedAction: "login",
          request,
        }),
        Promise.resolve(
          serviceClient
            .from("profiles")
            .select("id, user_id, status, is_active, user_roles(roles(code))")
            .ilike("email", email)
            .maybeSingle(),
        ).catch(() => ({ data: null })),
        Promise.resolve(
          serviceClient
            .from("staff")
            .select("id, is_active")
            .ilike("email", email)
            .maybeSingle(),
        ).catch(() => ({ data: null })),
        Promise.resolve(
          serviceClient
            .from("admins")
            .select("id, is_active")
            .ilike("email", email)
            .maybeSingle(),
        ).catch(() => ({ data: null })),
        createServerSupabaseClient({
          ephemeralSession: !rememberMe,
        }),
      ]);

    if (!turnstileCheck.ok) {
      return NextResponse.json(
        {
          success: false,
          code: turnstileCheck.code ?? "turnstile-verification-failed",
          errorCodes: turnstileCheck.errorCodes,
          error:
            turnstileCheck.error ??
            "Security verification failed. Please complete the Turnstile challenge and try again.",
        },
        { status: turnstileCheck.status },
      );
    }

    const profile = profileRes?.data as {
      id?: string;
      user_id?: string | null;
      status?: string | null;
      is_active?: boolean | null;
      user_roles?: Array<{ roles: { code: string } | null }> | null;
    } | null;
    const staffRow = staffRes?.data as { id?: string; is_active?: boolean | null } | null;
    const adminRow = adminRes?.data as { id?: string; is_active?: boolean | null } | null;

    const pStatus = (profile?.status || "").toString().toLowerCase().trim();
    const isDeactivatedInDb =
      pStatus === "inactive" ||
      pStatus === "deactivated" ||
      profile?.is_active === false ||
      staffRow?.is_active === false ||
      adminRow?.is_active === false;

    if (isDeactivatedInDb) {
      return NextResponse.json(
        {
          error:
            "Your account has been deactivated. Please contact the campus administrator or IT support for assistance.",
          is_deactivated: true,
        },
        { status: 403 },
      );
    }

    // Wave 2 (single Supabase Auth hop): verify credentials AND write SSR session cookies directly
    const { data: signInData, error: signInError } =
      await userClient.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError || !signInData?.session || !signInData?.user) {
      let preloadedUser = undefined;
      if (profile?.user_id) {
        const { data: byId } = await serviceClient.auth.admin
          .getUserById(profile.user_id)
          .catch(() => ({ data: { user: null } }));
        if (byId?.user) preloadedUser = byId.user;
      }

      const { record: attemptRecord, user: targetUser } =
        await getPersistentLoginAttempt(serviceClient, email, preloadedUser);

      if (attemptRecord.lockedUntil && attemptRecord.lockedUntil > now) {
        const remainingMins = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
        return NextResponse.json(
          {
            error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`,
          },
          { status: 429 },
        );
      }

      const currentCount = attemptRecord.count + 1;
      if (currentCount >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = now + LOCKOUT_DURATION_MS;
        await persistLoginAttempt(
          serviceClient,
          email,
          { count: currentCount, lockedUntil },
          targetUser,
        );
        return NextResponse.json(
          {
            error:
              "Too many failed login attempts. Account temporarily locked for 15 minutes.",
          },
          { status: 429 },
        );
      }

      await persistLoginAttempt(
        serviceClient,
        email,
        { count: currentCount },
        targetUser,
      );

      const remaining = MAX_FAILED_ATTEMPTS - currentCount;
      return NextResponse.json(
        {
          error: `Invalid login credentials. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining before temporary lockout.`,
        },
        { status: 400 },
      );
    }

    const authedUser = signInData.user;
    const appMeta = (authedUser.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (authedUser.user_metadata ?? {}) as Record<string, unknown>;

    // Check persistent lockout on the authenticated user
    const persistedLockedUntil = Number(
      appMeta.locked_until ?? userMeta.locked_until ?? 0,
    );
    if (Number.isFinite(persistedLockedUntil) && persistedLockedUntil > now) {
      await userClient.auth.signOut({ scope: "local" }).catch(() => null);
      const remainingMins = Math.ceil((persistedLockedUntil - now) / 60000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`,
        },
        { status: 429 },
      );
    }

    // Check account deactivation / ban flags in auth metadata
    const isDeactivatedInAuth =
      userMeta.is_active === false ||
      appMeta.is_active === false ||
      userMeta.status === "inactive" ||
      userMeta.status === "deactivated" ||
      Boolean(
        (authedUser as { banned_until?: string | null }).banned_until &&
          new Date((authedUser as { banned_until?: string }).banned_until!).getTime() > now,
      );

    if (isDeactivatedInAuth) {
      await userClient.auth.signOut({ scope: "local" }).catch(() => null);
      return NextResponse.json(
        {
          error:
            "Your account has been deactivated. Please contact the campus administrator or IT support for assistance.",
          is_deactivated: true,
        },
        { status: 403 },
      );
    }

    // Resolve authoritative role synchronously from auth metadata + Wave 1 DB records (0ms)
    const existingAppRole =
      typeof appMeta.role === "string" ? appMeta.role.trim().toLowerCase() : "";
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
      const dbRoleCode = profile?.user_roles?.[0]?.roles?.code
        ?.toLowerCase()
        .trim();
      if (dbRoleCode && !isAdminRoleToken(dbRoleCode)) {
        resolvedRole = dbRoleCode;
      } else if (staffRow?.id) {
        resolvedRole = ROLE.STAFF;
      } else {
        const legacyMetaRole =
          typeof userMeta.role === "string"
            ? userMeta.role.trim().toLowerCase()
            : "";
        resolvedRole =
          legacyMetaRole === ROLE.STAFF || legacyMetaRole === "staff"
            ? ROLE.STAFF
            : ROLE.FACULTY;
      }
    }

    const needsRoleBackfill =
      existingAppRole !== resolvedRole ||
      (isOriginalAdmin(email) && appMeta.is_primary_admin !== true);

    authedUser.app_metadata = {
      ...appMeta,
      role: resolvedRole,
      ...(isOriginalAdmin(email) ? { is_primary_admin: true } : {}),
    };

    // Determine MFA requirement synchronously from returned factors (avoids client AAL/listFactors round-trips)
    const verifiedTotpFactor = Array.isArray(authedUser.factors)
      ? authedUser.factors.find(
          (f: any) => f?.factor_type === "totp" && f?.status === "verified",
        )
      : null;

    const sessionId = crypto.randomUUID();
    const hasFailedAttemptState =
      Boolean(appMeta.failed_attempts) ||
      Boolean(appMeta.locked_until) ||
      Boolean(userMeta.failed_attempts) ||
      Boolean(userMeta.locked_until);

    // Non-blocking background bookkeeping (does not delay login response)
    after(async () => {
      try {
        const tasks: Array<Promise<unknown>> = [
          setActiveSession(authedUser.id, sessionId).catch(() => null),
          logTransactionEvent({
            actorId: authedUser.id,
            action: "auth.login",
            entityType: "user",
            entityId: authedUser.id,
            metadata: {
              email: authedUser.email,
              role: resolveTrustedUserRole(authedUser),
              sessionId,
            },
          }).catch(() => null),
        ];

        if (hasFailedAttemptState) {
          tasks.push(
            clearPersistentLoginLockout(serviceClient, email, authedUser).catch(
              () => null,
            ),
          );
        }

        if (needsRoleBackfill) {
          tasks.push(
            serviceClient.auth.admin
              .updateUserById(authedUser.id, {
                app_metadata: {
                  ...appMeta,
                  role: resolvedRole,
                  ...(isOriginalAdmin(email) ? { is_primary_admin: true } : {}),
                },
              })
              .catch(() => null),
          );
        }

        await Promise.all(tasks);
      } catch {
        // Non-fatal background sync
      }
    });

    const response = NextResponse.json({
      success: true,
      user: authedUser,
      session: signInData.session,
      rememberMe,
      sessionId,
      mfaRequired: Boolean(verifiedTotpFactor?.id),
      mfaFactorId: verifiedTotpFactor?.id ?? null,
    });

    response.cookies.set(
      "pup_focus_session_mode",
      rememberMe ? "persistent" : "ephemeral",
      rememberMe
        ? {
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
            sameSite: "lax",
          }
        : {
            path: "/",
            sameSite: "lax",
          },
    );

    response.cookies.set("pup_focus_session_id", sessionId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      ...(rememberMe ? { maxAge: 60 * 60 * 24 * 7 } : {}),
    });

    return response;
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Authentication server error.",
      },
      { status: 500 },
    );
  }
}
