import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
  try {
    let user: any = null;

    // 1. Try Bearer header
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (bearerToken) {
      const serviceClient = getServiceRoleClient();
      const { data: tokenUserData } = await serviceClient.auth.getUser(bearerToken);
      if (tokenUserData?.user) {
        user = tokenUserData.user;
      }
    }

    // 2. Try server cookies
    if (!user) {
      try {
        const userClient = await createServerSupabaseClient();
        const { data: cookieUserData } = await userClient.auth.getUser();
        if (cookieUserData?.user) {
          user = cookieUserData.user;
        }
      } catch {
        // Fallback
      }
    }

    // If unauthenticated, don't flag as concurrent conflict
    if (!user) {
      return NextResponse.json({ valid: true, unauthenticated: true });
    }

    const body = await request.json().catch(() => ({}));
    const clientLoginTimeStr =
      (typeof body.loginTime === "string" && body.loginTime.trim()) ||
      null;

    // If client hasn't provided login time yet or user has no last_sign_in_at, allow
    if (!clientLoginTimeStr || !user.last_sign_in_at) {
      return NextResponse.json({
        valid: true,
        lastSignInAt: user.last_sign_in_at ?? null,
      });
    }

    const clientTime = new Date(clientLoginTimeStr).getTime();
    const serverTime = new Date(user.last_sign_in_at).getTime();

    // If Supabase records a sign-in timestamp newer than this client's by > 3 seconds,
    // another login has taken place on another browser/device.
    if (serverTime - clientTime > 3000) {
      return NextResponse.json({
        valid: false,
        reason: "concurrent_login",
        message: "This account was logged in from another device or browser.",
      });
    }

    return NextResponse.json({
      valid: true,
      lastSignInAt: user.last_sign_in_at,
    });
  } catch (error) {
    console.error("[SessionVerify] Error:", error);
    return NextResponse.json({ valid: true, error: true });
  }
}
