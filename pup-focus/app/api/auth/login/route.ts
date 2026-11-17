import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile/verify";
import { filterCondition, orFilter } from "@/lib/supabase/filters";
import {
  LOCKOUT_DURATION_MS,
  MAX_FAILED_ATTEMPTS,
  clearPersistentLoginLockout,
  getPersistentLoginAttempt,
  persistLoginAttempt,
} from "@/lib/auth/login-attempts";
import { syncTrustedAppMetadataRole } from "@/lib/auth/admin-security";

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

    const turnstileCheck = await verifyTurnstileToken({
      token,
      expectedAction: "login",
      request,
    });
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

    const serviceClient = getServiceRoleClient();
    const now = Date.now();

    // 1. Check persistent & in-memory lockout state via indexed lookup (app_metadata)
    const { record: attemptRecord, user: targetUser } =
      await getPersistentLoginAttempt(serviceClient, email);

    if (attemptRecord.lockedUntil && attemptRecord.lockedUntil > now) {
      const remainingMins = Math.ceil((attemptRecord.lockedUntil - now) / 60000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`,
        },
        { status: 429 },
      );
    }

    // Check if account is deactivated or inactive across user_metadata, profiles, staff, or admins tables
    let isDeactivated = false;
    if (targetUser) {
      if (
        targetUser.user_metadata?.is_active === false ||
        targetUser.app_metadata?.is_active === false ||
        targetUser.user_metadata?.status === "inactive" ||
        targetUser.user_metadata?.status === "deactivated"
      ) {
        isDeactivated = true;
      }
      if (targetUser.banned_until && new Date(targetUser.banned_until).getTime() > now) {
        isDeactivated = true;
      }
    }

    if (!isDeactivated) {
      try {
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("status, is_active")
          .or(
            orFilter([
              ...(targetUser?.id
                ? [
                    filterCondition("id", "eq", targetUser.id),
                    filterCondition("user_id", "eq", targetUser.id),
                  ]
                : []),
              filterCondition("email", "eq", email),
            ])
          )
          .maybeSingle();
        const pStatus = (profile?.status || "").toString().toLowerCase().trim();
        if (pStatus === "inactive" || pStatus === "deactivated" || profile?.is_active === false) {
          isDeactivated = true;
        }
      } catch {}
    }

    if (!isDeactivated) {
      try {
        const { data: staffRow } = await serviceClient
          .from("staff")
          .select("is_active")
          .ilike("email", email)
          .maybeSingle();
        if (staffRow?.is_active === false) {
          isDeactivated = true;
        }
      } catch {}
    }

    if (!isDeactivated) {
      try {
        const { data: adminRow } = await serviceClient
          .from("admins")
          .select("is_active")
          .ilike("email", email)
          .maybeSingle();
        if (adminRow?.is_active === false) {
          isDeactivated = true;
        }
      } catch {}
    }

    if (isDeactivated) {
      return NextResponse.json(
        {
          error: "Your account has been deactivated. Please contact the campus administrator or IT support for assistance.",
          is_deactivated: true,
        },
        { status: 403 },
      );
    }

    // 3. Verify credentials via service role client
    const { data: signInData, error: signInError } = await serviceClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      const existingCount = attemptRecord.count;
      const currentCount = existingCount + 1;

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
            error: "Too many failed login attempts. Account temporarily locked for 15 minutes.",
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

    // 4. Verify account status before issuing session
    const authedUser = signInData.user ?? targetUser;
    if (
      authedUser?.user_metadata?.is_active === false ||
      authedUser?.app_metadata?.is_active === false ||
      authedUser?.user_metadata?.status === "inactive" ||
      authedUser?.user_metadata?.status === "deactivated"
    ) {
      return NextResponse.json(
        {
          error: "Your account has been deactivated. Please contact the campus administrator or IT support for assistance.",
          is_deactivated: true,
        },
        { status: 403 },
      );
    }

    // Reset failed attempts & auto-backfill immutable app_metadata.role upon login
    await clearPersistentLoginLockout(serviceClient, email, authedUser);
    const syncedRole = signInData.user
      ? await syncTrustedAppMetadataRole(serviceClient, signInData.user)
      : undefined;

    if (signInData.user && syncedRole) {
      signInData.user.app_metadata = {
        ...(signInData.user.app_metadata ?? {}),
        role: syncedRole,
      };
    }

    // Synchronize session cookies (session-only when Remember Me is unchecked)
    const userClient = await createServerSupabaseClient({
      ephemeralSession: !rememberMe,
    });
    await userClient.auth.setSession(signInData.session).catch(() => null);

    const response = NextResponse.json({
      success: true,
      user: signInData.user,
      session: signInData.session,
      rememberMe,
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
