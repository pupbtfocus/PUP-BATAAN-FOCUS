import { after, NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clearActiveSession } from "@/lib/auth/session-tracker";
import { resolveTrustedUserRole } from "@/config/roles";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const bearerToken = authHeader.toLowerCase().startsWith("bearer ")
      ? authHeader.slice(7).trim()
      : null;

    const supabase = await createServerSupabaseClient();

    // Perform remote auth lookup, active-session clearing, and audit logging after sending the response
    after(async () => {
      try {
        const {
          data: { user },
        } = bearerToken
          ? await supabase.auth.getUser(bearerToken)
          : await supabase.auth.getUser();

        if (user) {
          await Promise.allSettled([
            clearActiveSession(
              user.id,
              (user.app_metadata ?? {}) as Record<string, unknown>,
            ),
            logTransactionEvent({
              actorId: user.id,
              action: "auth.logout",
              entityType: "user",
              entityId: user.id,
              metadata: {
                email: user.email,
                role: resolveTrustedUserRole(user),
              },
            }),
          ]);
        }
      } catch {
        // Non-fatal background cleanup error
      }
    });

    const response = NextResponse.json({ success: true });
    request.cookies.getAll().forEach((cookie) => {
      if (
        cookie.name.startsWith("sb-") ||
        cookie.name === "pup_focus_session_mode" ||
        cookie.name === "pup_focus_session_id"
      ) {
        response.cookies.set(cookie.name, "", {
          path: "/",
          maxAge: 0,
          expires: new Date(0),
        });
      }
    });
    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}
