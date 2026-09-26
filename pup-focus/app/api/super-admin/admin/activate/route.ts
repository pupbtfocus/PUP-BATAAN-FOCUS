import { NextResponse, type NextRequest } from "next/server";
import { ROLE, canManageAdminAccount } from "@/config/roles";
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

    const { data: targetAuthData, error: targetError } =
      await supabase.auth.admin.getUserById(profileId);

    if (targetError || !targetAuthData?.user) {
      return NextResponse.json(
        { error: "Target admin account not found" },
        { status: 404 },
      );
    }

    const targetUser = targetAuthData.user;
    const targetEmail = targetUser.email ?? "";
    const targetRole =
      (targetUser.user_metadata?.role as string | undefined) ??
      (targetUser.app_metadata?.role as string | undefined) ??
      ROLE.ADMIN;

    const allowed = canManageAdminAccount({
      targetEmail,
      targetRole,
      actorEmail: user.email,
      action: "deactivate",
    });

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to activate this admin account" },
        { status: 403 },
      );
    }

    try {
      await supabase
        .from("profiles")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", profileId);
    } catch {}

    try {
      await supabase.auth.admin.updateUserById(profileId, {
        user_metadata: { ...targetUser.user_metadata, is_active: true },
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to activate admin", details: String(error) },
      { status: 500 },
    );
  }
}
