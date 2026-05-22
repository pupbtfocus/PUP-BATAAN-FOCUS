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
    const { data: appUsers, error: appUsersError } = await supabase
      .from("app_users")
      .select("profile_id, auth_user_id, metadata, created_at")
      .eq("role", ROLE.ADMIN)
      .order("created_at", { ascending: false });

    if (appUsersError) {
      return NextResponse.json(
        {
          error: "Failed to load admin accounts",
          details: appUsersError.message,
        },
        { status: 500 },
      );
    }

    const panelCreatedAppUsers = (appUsers ?? []).filter((item) => {
      const metadata =
        item.metadata && typeof item.metadata === "object"
          ? (item.metadata as Record<string, unknown>)
          : null;

      return (
        metadata?.created_via === "super_admin_admin_panel" ||
        typeof metadata?.created_by_super_admin_id === "string"
      );
    });

    const filteredAppUsers =
      panelCreatedAppUsers.length > 0 ? panelCreatedAppUsers : (appUsers ?? []);

    const profileIds = filteredAppUsers
      .map((item) => item.profile_id)
      .filter((value): value is string => Boolean(value));

    if (profileIds.length === 0) {
      return NextResponse.json({ admins: [] });
    }

    const { data, error } = await supabase
      .from("admins")
      .select(
        "id, profile_id, full_name, email, department, permissions, is_active, created_at",
      )
      .in("profile_id", profileIds)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load admin accounts", details: error.message },
        { status: 500 },
      );
    }

    const authUserByProfileId = new Map(
      filteredAppUsers.map((item) => [item.profile_id, item.auth_user_id]),
    );

    const admins = (data ?? []).map((admin) => ({
      ...admin,
      auth_user_id: authUserByProfileId.get(admin.profile_id) ?? null,
    }));

    return NextResponse.json({ admins });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin accounts", details: String(error) },
      { status: 500 },
    );
  }
}
