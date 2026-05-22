import { NextResponse, type NextRequest } from "next/server";
import { ROLE } from "@/config/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: NextRequest) {
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

  const profileId = new URL(request.url).searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = getServiceRoleClient();

    const { data: appUser, error: appUserError } = await supabase
      .from("app_users")
      .select(
        "auth_user_id, profile_id, role, metadata, created_at, updated_at",
      )
      .eq("profile_id", profileId)
      .eq("role", ROLE.ADMIN)
      .maybeSingle();

    if (appUserError || !appUser) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const { data: admin, error: adminError } = await supabase
      .from("admins")
      .select(
        "id, profile_id, full_name, email, department, permissions, is_active, created_at, updated_at",
      )
      .eq("profile_id", profileId)
      .maybeSingle();

    if (adminError || !admin) {
      return NextResponse.json(
        { error: "Admin details not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      details: {
        ...admin,
        auth_user_id: appUser.auth_user_id,
        role: appUser.role,
        metadata: appUser.metadata ?? {},
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin details", details: String(error) },
      { status: 500 },
    );
  }
}
