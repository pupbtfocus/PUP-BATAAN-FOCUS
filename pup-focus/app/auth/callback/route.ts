import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { bootstrapInvitedAdminAccount } from "@/lib/auth/bootstrap-invited-admin";
import { bootstrapInvitedFacultyAccount } from "@/lib/auth/bootstrap-invited-faculty";
import type { EmailOtpType } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = url.searchParams.get("next") ?? "/";
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(errorDescription || error)}`,
        request.url,
      ),
    );
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", request.url),
    );
  }

  const supabase = await createServerSupabaseClient();

  // Force sign-out any existing active session (e.g. Superadmin) BEFORE code exchange or OTP verification
  // if this is an invite flow or if exchanging an auth code, preventing session collision.
  const isInviteOrAuthAction = type === "invite" || Boolean(code) || Boolean(tokenHash);
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
  } else if (tokenHash && type) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (verifyError) {
      authErrorMessage = verifyError.message;
    }
  }

  if (authErrorMessage) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(authErrorMessage)}`,
        request.url,
      ),
    );
  }

  // Check if the account is active
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const serviceRoleClient = getServiceRoleClient();
    const { data: appUser } = await serviceRoleClient
      .from("app_users")
      .select("id, auth_user_id, profile_id, metadata")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    // if metadata has explicit is_active === false, block sign-in
    if (appUser && appUser.metadata && appUser.metadata.is_active === false) {
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

    if (!appUser) {
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
  }

  return NextResponse.redirect(new URL(next, request.url));
}
