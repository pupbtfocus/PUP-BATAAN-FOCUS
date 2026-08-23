import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ROLE, type AppRole } from "@/config/roles";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the profile record joined with user_roles
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, user_roles(roles(code, name))")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to get user profile" },
        { status: 400 },
      );
    }

    const userRoles = profile?.user_roles as
      | Array<{ roles: { code: string; name: string } | null }>
      | undefined;
    const role =
      (userRoles?.[0]?.roles?.code as AppRole | undefined) ??
      (user.user_metadata?.role as AppRole | undefined) ??
      ROLE.FACULTY;

    const profileId = profile?.id ?? user.id;

    return NextResponse.json({
      id: user.id,
      email: profile?.email ?? user.email,
      profile_id: profileId,
      role,
      full_name:
        profile?.full_name ??
        (user.user_metadata?.full_name as string | undefined) ??
        "",
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Failed to get user info" },
      { status: 500 },
    );
  }
}

