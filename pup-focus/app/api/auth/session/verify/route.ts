import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { getActiveSession, setActiveSession } from "@/lib/auth/session-tracker";

export async function POST(request: NextRequest) {
  try {
    let user: any = null;

    // 1. Try server cookies
    try {
      const userClient = await createServerSupabaseClient();
      const { data: cookieUserData } = await userClient.auth.getUser();
      if (cookieUserData?.user) {
        user = cookieUserData.user;
      }
    } catch {
      // Fallback
    }

    // 2. Try Bearer header
    if (!user) {
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
    }

    // If unauthenticated, don't flag as concurrent conflict
    if (!user) {
      return NextResponse.json({ valid: true, unauthenticated: true });
    }

    const body = await request.json().catch(() => ({}));
    const clientSessionId =
      (typeof body.sessionId === "string" && body.sessionId.trim()) ||
      request.cookies.get("pup_focus_session_id")?.value?.trim() ||
      request.headers.get("x-session-id")?.trim() ||
      null;

    const activeSessionId = await getActiveSession(user.id);

    // If no active session recorded yet and client sent one, claim it
    if (!activeSessionId && clientSessionId) {
      await setActiveSession(user.id, clientSessionId);
      return NextResponse.json({ valid: true });
    }

    // If active session exists and client has a differing session ID -> CONFLICT!
    if (activeSessionId && clientSessionId && activeSessionId !== clientSessionId) {
      return NextResponse.json({
        valid: false,
        reason: "concurrent_login",
        message: "This account was logged in from another device or browser.",
      });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("[SessionVerify] Error:", error);
    // On unexpected error, do not aggressively kick user
    return NextResponse.json({ valid: true, error: true });
  }
}
