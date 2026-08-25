import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { bootstrapInvitedAdminAccount } from "@/lib/auth/bootstrap-invited-admin";
import { bootstrapInvitedFacultyAccount } from "@/lib/auth/bootstrap-invited-faculty";
import type { EmailOtpType } from "@supabase/supabase-js";

function formatInviteErrorMessage(rawError: string): string {
  const normalized = rawError.trim().toLowerCase();
  if (normalized.includes("access_denied") || normalized.includes("already been used")) {
    return "This invite link was already used. Please sign in or ask an administrator for a new invitation.";
  }
  if (normalized.includes("expired") || normalized.includes("token has expired")) {
    return "This invitation link has expired. Please ask an administrator to send a new invite.";
  }
  return rawError;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const message = formatInviteErrorMessage(errorDescription || error);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(message)}`, request.url),
    );
  }

  if (!code && !tokenHash && !token) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", request.url),
    );
  }

  const supabase = await createServerSupabaseClient();

  // Force sign-out any existing active session (e.g. Superadmin) BEFORE code exchange or OTP verification
  // if this is an invite flow or if exchanging an auth code, preventing session collision.
  const isInviteOrAuthAction =
    type === "invite" ||
    url.searchParams.get("type") === "invite" ||
    Boolean(code) ||
    Boolean(tokenHash) ||
    Boolean(token);

  if (isInviteOrAuthAction) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut failure if no active session
    }
  }

  let authErrorMessage: string | null = null;

  if (code) {
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      authErrorMessage = exchangeError.message;
    }
  } else if (tokenHash) {
    const otpType: EmailOtpType = type || "invite";
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (verifyError) {
      authErrorMessage = verifyError.message;
    }
  } else if (token) {
    const otpType: EmailOtpType = type || "invite";
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token,
      type: otpType,
    } as Parameters<typeof supabase.auth.verifyOtp>[0]);
    if (verifyError) {
      authErrorMessage = verifyError.message;
    }
  }

  if (authErrorMessage) {
    const message = formatInviteErrorMessage(authErrorMessage);
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent(message)}`, request.url),
    );
  }

  // Check authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // If metadata has explicit is_active === false, block sign-in
    if (user.user_metadata?.is_active === false) {
      await supabase.auth.signOut();
      return NextResponse.redirect(
        new URL(
          "/sign-in?error=" +
            encodeURIComponent(
              "Your account has been deactivated. Please contact an administrator.",
            ),
          request.url,
        ),
      );
    }

    const serviceRoleClient = getServiceRoleClient();
    const { data: profile } = await serviceRoleClient
      .from("profiles")
      .select("id, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      try {
        await bootstrapInvitedAdminAccount(user);
        await bootstrapInvitedFacultyAccount(user);
      } catch (bootstrapError) {
        await supabase.auth.signOut();
        return NextResponse.redirect(
          new URL(
            `/sign-in?error=${encodeURIComponent(
              bootstrapError instanceof Error
                ? bootstrapError.message
                : "Failed to complete invited account setup",
            )}`,
            request.url,
          ),
        );
      }
    }

    // Check if user is newly invited or must set/change password
    const isInvite =
      type === "invite" ||
      url.searchParams.get("type") === "invite" ||
      user.user_metadata?.must_change_password === true ||
      user.user_metadata?.force_password_change === true ||
      user.user_metadata?.created_via === "admin_faculty_panel" ||
      user.user_metadata?.created_via === "superadmin_admin_panel";

    const isRecovery =
      type === "recovery" ||
      url.searchParams.get("type") === "recovery";

    if (isInvite || isRecovery) {
      return NextResponse.redirect(
        new URL("/auth/set-password", request.url),
      );
    }
  }

  return NextResponse.redirect(new URL(next || "/", request.url));
}
