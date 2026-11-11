import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  extractTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/turnstile/verify";
import { filterCondition, orFilter } from "@/lib/supabase/filters";

// In-memory lockout cache: 5 failed attempts -> 15-minute timeout
interface AttemptRecord {
  count: number;
  lockedUntil?: number;
}
const loginAttempts = new Map<string, AttemptRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

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

    // 1. Check in-memory lock first
    const memoryRecord = loginAttempts.get(email);
    if (memoryRecord?.lockedUntil && memoryRecord.lockedUntil > now) {
      const remainingMins = Math.ceil((memoryRecord.lockedUntil - now) / 60000);
      return NextResponse.json(
        {
          error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`,
        },
        { status: 429 },
      );
    }

    // 2. Check persistent lock and deactivation status in Supabase user_metadata across all browsers/devices
    let targetUser: any = null;
    try {
      const { data: usersData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
      targetUser = (usersData?.users ?? []).find(
        (u) => (u.email || "").toLowerCase().trim() === email,
      );
      if (targetUser?.user_metadata?.locked_until) {
        const persistentLockedUntil = Number(targetUser.user_metadata.locked_until);
        if (persistentLockedUntil > now) {
          loginAttempts.set(email, {
            count: MAX_FAILED_ATTEMPTS,
            lockedUntil: persistentLockedUntil,
          });
          const remainingMins = Math.ceil((persistentLockedUntil - now) / 60000);
          return NextResponse.json(
            {
              error: `Account temporarily locked due to consecutive failed attempts. Please try again in ${remainingMins} minute${remainingMins > 1 ? "s" : ""}.`,
            },
            { status: 429 },
          );
        }
      }
    } catch {
      // Continue if listUsers fails
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
      const existingCount =
        (memoryRecord && (!memoryRecord.lockedUntil || memoryRecord.lockedUntil <= now))
          ? memoryRecord.count
          : Number(targetUser?.user_metadata?.failed_attempts || 0);

      const currentCount = existingCount + 1;

      if (currentCount >= MAX_FAILED_ATTEMPTS) {
        const lockedUntil = now + LOCKOUT_DURATION_MS;
        loginAttempts.set(email, {
          count: currentCount,
          lockedUntil,
        });

        if (targetUser?.id) {
          try {
            await serviceClient.auth.admin.updateUserById(targetUser.id, {
              user_metadata: {
                ...(targetUser.user_metadata ?? {}),
                failed_attempts: currentCount,
                locked_until: lockedUntil,
              },
            });
          } catch {}
        }

        return NextResponse.json(
          {
            error: "Too many failed login attempts. Account temporarily locked for 15 minutes.",
          },
          { status: 429 },
        );
      }

      loginAttempts.set(email, { count: currentCount });
      if (targetUser?.id) {
        try {
          await serviceClient.auth.admin.updateUserById(targetUser.id, {
            user_metadata: {
              ...(targetUser.user_metadata ?? {}),
              failed_attempts: currentCount,
              locked_until: null,
            },
          });
        } catch {}
      }

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

    // Reset failed attempts upon successful login in memory and database
    loginAttempts.delete(email);
    const authedUserId = signInData.user?.id || targetUser?.id;
    if (authedUserId) {
      try {
        await serviceClient.auth.admin.updateUserById(authedUserId, {
          user_metadata: {
            ...(signInData.user?.user_metadata ?? targetUser?.user_metadata ?? {}),
            failed_attempts: 0,
            locked_until: null,
          },
        });
      } catch {}
    }

    // Synchronize session cookies
    const userClient = await createServerSupabaseClient();
    await userClient.auth.setSession(signInData.session).catch(() => null);

    return NextResponse.json({
      success: true,
      user: signInData.user,
      session: signInData.session,
    });
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
