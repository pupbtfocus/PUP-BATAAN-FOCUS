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

    const { data: appUser } = await supabase
      .from("app_users")
      .select("auth_user_id, role")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (
      !appUser ||
      ![ROLE.ADMIN, ROLE.SUPER_ADMIN].includes(
        appUser.role as (typeof ROLE)[keyof typeof ROLE],
      )
    ) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", profileId)
      .maybeSingle();

    await supabase
      .from("admin_assignments")
      .delete()
      .eq("admin_profile_id", profileId);

    await supabase.from("user_roles").delete().eq("profile_id", profileId);
    await supabase.from("admins").delete().eq("profile_id", profileId);
    await supabase
      .from("app_users")
      .delete()
      .or(`profile_id.eq.${profileId},auth_user_id.eq.${appUser.auth_user_id}`);
    await supabase.from("profiles").delete().eq("id", profileId);

    const authUserId = appUser.auth_user_id ?? profile?.user_id;
    if (authUserId) {
      await supabase.auth.admin.deleteUser(authUserId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete admin", details: String(error) },
      { status: 500 },
    );
  }
}
