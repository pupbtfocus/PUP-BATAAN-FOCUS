import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET() {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const service = getServiceRoleClient();
    const { data: appUser } = await service
      .from("app_users")
      .select("metadata")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    const isActive = appUser?.metadata?.is_active ?? true;

    return NextResponse.json({ is_active: isActive });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
