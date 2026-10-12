import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

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
    // Verify credentials via service role client (bypasses bot/captcha enforcement on server)
    const { data: signInData, error: signInError } = await serviceClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError || !signInData?.session) {
      return NextResponse.json(
        { error: signInError?.message || "Invalid login credentials." },
        { status: 400 },
      );
    }

    // Synchronize session cookies
    const userClient = await createServerSupabaseClient();
    await userClient.auth.setSession(signInData.session).catch(() => null);

    // Register active single-session ID
    const sessionId =
      (typeof body.sessionId === "string" && body.sessionId.trim()) ||
      crypto.randomUUID();
    const { setActiveSession } = await import("@/lib/auth/session-tracker");
    await setActiveSession(signInData.user.id, sessionId);

    const response = NextResponse.json({
      success: true,
      user: signInData.user,
      session: signInData.session,
      sessionId,
    });

    response.cookies.set("pup_focus_session_id", sessionId, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
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
