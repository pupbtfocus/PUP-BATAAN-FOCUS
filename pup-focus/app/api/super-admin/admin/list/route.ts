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
    const { data: admins, error: adminsError } = await supabase
      .from("admins")
      .select(
        "id, profile_id, full_name, email, department, permissions, is_active, created_at",
      )
      .order("created_at", { ascending: false });

    if (adminsError) {
      return NextResponse.json(
        {
          error: "Failed to load admin accounts",
          details: adminsError.message,
        },
        { status: 500 },
      );
    }

    const profileIds = (admins ?? [])
      .map((item) => item.profile_id)
      .filter((value): value is string => Boolean(value));

    if (profileIds.length === 0) {
      return NextResponse.json({ admins: [] });
    }

    const { data: appUsers, error: appUsersError } = await supabase
      .from("app_users")
      .select("profile_id, auth_user_id, role, metadata, created_at")
      .in("profile_id", profileIds);

    if (appUsersError) {
      return NextResponse.json(
        {
          error: "Failed to load admin accounts",
          details: appUsersError.message,
        },
        { status: 500 },
      );
    }

    const authUserByProfileId = new Map(
      (appUsers ?? []).map((item) => [item.profile_id, item.auth_user_id]),
    );

    const roleByProfileId = new Map(
      (appUsers ?? []).map((item) => [item.profile_id, item.role]),
    );

    const enrichedAdmins = (admins ?? []).map((admin) => ({
      ...admin,
      auth_user_id: authUserByProfileId.get(admin.profile_id) ?? null,
      role: roleByProfileId.get(admin.profile_id) ?? ROLE.ADMIN,
    }));

    return NextResponse.json({ admins: enrichedAdmins });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin accounts", details: String(error) },
      { status: 500 },
    );
  }
}
