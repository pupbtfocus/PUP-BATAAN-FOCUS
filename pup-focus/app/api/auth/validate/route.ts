import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const isActive = user.user_metadata?.is_active ?? true;

    return NextResponse.json({ is_active: isActive });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

