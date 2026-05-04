import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the app_user record to get profile_id
    const { data: appUser, error } = await supabase
      .from("app_users")
      .select("profile_id, role")
      .eq("auth_user_id", user.id)
      .single();

    if (error || !appUser) {
      return NextResponse.json(
        { error: "Failed to get user profile" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      profile_id: appUser.profile_id,
      role: appUser.role,
    });
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Failed to get user info" },
      { status: 500 },
    );
  }
}
