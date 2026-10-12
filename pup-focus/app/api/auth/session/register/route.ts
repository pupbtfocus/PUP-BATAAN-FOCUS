import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { setActiveSession } from "@/lib/auth/session-tracker";

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

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim().length > 0
        ? body.sessionId.trim()
        : crypto.randomUUID();

    await setActiveSession(user.id, sessionId);

    const response = NextResponse.json({
      success: true,
      sessionId,
      userId: user.id,
    });

    response.cookies.set("pup_focus_session_id", sessionId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false, // Accessible to client if needed
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error("[SessionRegister] Error:", error);
    return NextResponse.json(
      { error: "Failed to register active session" },
      { status: 500 },
    );
  }
}
