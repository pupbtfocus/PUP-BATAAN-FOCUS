import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { setActiveSession } from "@/lib/auth/session-tracker";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
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

    // 3. Try body.userId with service role client verification
    if (!user && typeof body.userId === "string" && body.userId.trim()) {
      try {
        const serviceClient = getServiceRoleClient();
        const { data: directUser } = await serviceClient.auth.admin.getUserById(
          body.userId.trim(),
        );
        if (directUser?.user) {
          user = directUser.user;
        }
      } catch {
        // Fallback
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sessionId =
      typeof body.sessionId === "string" && body.sessionId.trim().length > 0
        ? body.sessionId.trim()
        : crypto.randomUUID();

    await setActiveSession(user.id, sessionId);

    void logTransactionEvent({
      actorId: user.id,
      action: "auth.login",
      entityType: "user",
      entityId: user.id,
      metadata: {
        email: user.email,
        role: user.user_metadata?.role || user.app_metadata?.role,
        sessionId,
      },
    });

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
