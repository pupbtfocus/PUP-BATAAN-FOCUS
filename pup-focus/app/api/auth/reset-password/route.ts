import { NextResponse, type NextRequest } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, accessToken } = body;

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long." },
        { status: 400 },
      );
    }

    if (!accessToken || typeof accessToken !== "string") {
      return NextResponse.json(
        {
          error:
            "Your password reset session is missing or has expired. Please request a new reset link from the sign-in page.",
        },
        { status: 401 },
      );
    }

    const supabase = getServiceRoleClient();

    // 1. Verify the access token cryptographically using Supabase Auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        {
          error:
            "Your password reset session has expired or is invalid. Please request a new reset link from the sign-in page.",
        },
        { status: 401 },
      );
    }

    // 2. Update the user's password and clear force change flags
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password,
        user_metadata: {
          ...user.user_metadata,
          must_change_password: false,
          force_password_change: false,
        },
      },
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update password." },
        { status: 400 },
      );
    }

    const role =
      user.user_metadata?.role ||
      user.app_metadata?.role ||
      "faculty";

    return NextResponse.json({
      success: true,
      role,
      email: user.email,
    });
  } catch (err: any) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: err?.message || "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
