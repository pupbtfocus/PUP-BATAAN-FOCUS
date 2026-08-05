import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const requesterRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);

  if (
    !user ||
    (requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== ROLE.ADMIN)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { profileId } = await request.json();

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 },
      );
    }

    const supabase = getServiceRoleClient();

    try {
      await supabase.from("profiles").delete().eq("id", profileId);
    } catch {}

    try {
      await supabase.auth.admin.deleteUser(profileId);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete admin account", details: String(error) },
      { status: 500 },
    );
  }
}
