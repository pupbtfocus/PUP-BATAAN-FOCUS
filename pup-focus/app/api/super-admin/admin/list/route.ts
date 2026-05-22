import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE } from "@/config/roles";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const requesterRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);

  if (!user || requesterRole !== ROLE.SUPER_ADMIN) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
      .from("admins")
      .select(
        "id, full_name, email, department, permissions, is_active, created_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load admin accounts", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ admins: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin accounts", details: String(error) },
      { status: 500 },
    );
  }
}
