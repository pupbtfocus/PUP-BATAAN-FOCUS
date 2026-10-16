import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { formatPasswordError, validatePasswordRequirements } from "@/lib/validation/password";

export async function POST(request: NextRequest) {
  try {
    const serviceClient = getServiceRoleClient();
    let user: any = null;

    // 1. Check Bearer token from Authorization header
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

    if (bearerToken) {
      const { data: tokenUserData } = await serviceClient.auth.getUser(bearerToken);
      if (tokenUserData?.user) {
        user = tokenUserData.user;
      }
    }

    // 2. Fallback to server cookies
    if (!user) {
      try {
        const userClient = await createServerSupabaseClient();
        const { data: cookieUserData } = await userClient.auth.getUser();
        if (cookieUserData?.user) {
          user = cookieUserData.user;
        }
      } catch {
        // Fallback
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in again." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const oldPassword = typeof body.oldPassword === "string" ? body.oldPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!oldPassword.trim()) {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 },
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 },
      );
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { error: "New password cannot be the same as your current password." },
        { status: 400 },
      );
    }

    // Validate full password complexity requirements BEFORE verifying credentials.
    // This prevents bumping user.last_sign_in_at on Supabase if the new password is invalid.
    const validation = validatePasswordRequirements(newPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: `Password must include:\n${validation.missingRequirements.map((r) => `• ${r}`).join("\n")}`,
        },
        { status: 400 },
      );
    }

    // Resolve user email
    if (!user.email) {
      const { data: adminUser } = await serviceClient.auth.admin.getUserById(user.id);
      if (adminUser?.user?.email) {
        user.email = adminUser.user.email;
      }
    }

    const clientEmail = typeof body.email === "string" ? body.email.trim() : "";
    const candidateEmails = Array.from(
      new Set(
        [user.email, user.email?.toLowerCase(), clientEmail, clientEmail.toLowerCase()]
          .filter((e): e is string => typeof e === "string" && e.trim().length > 0)
      )
    );

    let isPasswordCorrect = false;
    let verifiedLoginTime: string | null = null;

    for (const emailToVerify of candidateEmails) {
      const { data: verifiedSignInData, error } = await serviceClient.auth.signInWithPassword({
        email: emailToVerify,
        password: oldPassword,
      });
      if (!error && verifiedSignInData?.user) {
        isPasswordCorrect = true;
        verifiedLoginTime =
          verifiedSignInData.user.last_sign_in_at ||
          verifiedSignInData.session?.user?.last_sign_in_at ||
          new Date().toISOString();
        break;
      }
    }

    if (!isPasswordCorrect) {
      return NextResponse.json(
        { error: "Incorrect current password. Please check your credentials and try again." },
        { status: 400 },
      );
    }

    // Update password securely using service role admin
    const { error: updateError } = await serviceClient.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword,
        user_metadata: {
          ...user.user_metadata,
          must_change_password: false,
          force_password_change: false,
        },
      },
    );

    if (updateError) {
      return NextResponse.json(
        {
          error: formatPasswordError(updateError.message) || "Failed to update password.",
          loginTime: verifiedLoginTime,
        },
        { status: 400 },
      );
    }

    // Re-authenticate user with the new password so the session remains active and refreshed
    let newSession = null;
    let newUser = null;

    for (const emailToLogin of candidateEmails) {
      const { data: signInData, error: signInErr } = await serviceClient.auth.signInWithPassword({
        email: emailToLogin,
        password: newPassword,
      });
      if (!signInErr && signInData?.session) {
        newSession = signInData.session;
        newUser = signInData.user;
        break;
      }
    }

    if (newSession) {
      try {
        const userClient = await createServerSupabaseClient();
        await userClient.auth.setSession(newSession).catch(() => null);
      } catch {
        // Fallback
      }
    }

    const updatedLoginTime =
      newUser?.last_sign_in_at ||
      newSession?.user?.last_sign_in_at ||
      verifiedLoginTime ||
      new Date().toISOString();

    return NextResponse.json({
      success: true,
      message: "Password updated successfully.",
      session: newSession,
      user: newUser,
      loginTime: updatedLoginTime,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while updating your password.",
      },
      { status: 500 },
    );
  }
}
