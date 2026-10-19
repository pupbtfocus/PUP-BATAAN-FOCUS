import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      await logTransactionEvent({
        actorId: user.id,
        action: "auth.logout",
        entityType: "user",
        entityId: user.id,
        metadata: {
          email: user.email,
          role: user.user_metadata?.role || user.app_metadata?.role,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
