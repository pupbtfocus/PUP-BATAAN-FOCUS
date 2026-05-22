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

  if (!user || requesterRole !== ROLE.SUPER_ADMIN) {
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
      .select("id, metadata")
      .eq("profile_id", profileId)
      .in("role", [ROLE.ADMIN, ROLE.SUPER_ADMIN])
      .maybeSingle();

    if (!appUser) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const { error: adminUpdateError } = await supabase
      .from("admins")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId);

    if (adminUpdateError) {
      return NextResponse.json(
        {
          error: "Failed to deactivate admin",
          details: adminUpdateError.message,
        },
        { status: 500 },
      );
    }

    const nextMetadata = { ...(appUser.metadata ?? {}), is_active: false };
    await supabase
      .from("app_users")
      .update({ metadata: nextMetadata, updated_at: new Date().toISOString() })
      .eq("profile_id", profileId)
      .in("role", [ROLE.ADMIN, ROLE.SUPER_ADMIN]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to deactivate admin", details: String(error) },
      { status: 500 },
    );
  }
}
