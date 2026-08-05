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

  if (
    !user ||
    (requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== ROLE.ADMIN)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId");

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = getServiceRoleClient();

    let profile: any = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, status, avatar_url, created_at")
        .eq("id", profileId)
        .maybeSingle();
      profile = data;
    } catch {}

    const authRes = await supabase.auth.admin.getUserById(profileId);
    const authUser = authRes.data?.user;

    if (!profile && !authUser) {
      return NextResponse.json(
        { error: "Admin account not found" },
        { status: 404 },
      );
    }

    const fullName =
      profile?.full_name ||
      authUser?.user_metadata?.full_name ||
      authUser?.user_metadata?.name ||
      authUser?.email?.split("@")[0] ||
      "Admin User";
    const email = profile?.email || authUser?.email || "";
    const role =
      profile?.role ||
      authUser?.user_metadata?.role ||
      authUser?.app_metadata?.role ||
      ROLE.ADMIN;
    const avatarUrl =
      profile?.avatar_url || authUser?.user_metadata?.avatar_url || null;
    const isActive =
      profile?.status === "active" ||
      profile?.status === "true" ||
      authUser?.user_metadata?.is_active !== false;

    return NextResponse.json({
      details: {
        id: profileId,
        profile_id: profileId,
        full_name: fullName,
        email,
        role,
        department: "Administration",
        permissions: [],
        is_active: isActive,
        created_at: profile?.created_at || authUser?.created_at,
        profileImageUrl: avatarUrl,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load admin details", details: String(error) },
      { status: 500 },
    );
  }
}
