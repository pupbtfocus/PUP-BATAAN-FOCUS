import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

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
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
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

    // 2. Check persistent lock in Supabase user_metadata across all browsers/devices
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

    // 4. Reset failed attempts upon successful login in memory and database
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
