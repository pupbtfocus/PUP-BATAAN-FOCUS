import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clearActiveSession } from "@/lib/auth/session-tracker";
import { resolveTrustedUserRole } from "@/config/roles";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await clearActiveSession(user.id);
      await logTransactionEvent({
        actorId: user.id,
        action: "auth.logout",
        entityType: "user",
        entityId: user.id,
        metadata: {
          email: user.email,
          role: resolveTrustedUserRole(user),
        },
      });
    }

    await supabase.auth.signOut({ scope: "local" }).catch(() => null);

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
