import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(
      new URL("/sign-in?error=missing_code", request.url),
    );
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/sign-in?error=${encodeURIComponent(error.message)}`,
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
      .select("is_active")
      .eq("user_id", user.id)
      .single();

    if (appUser && !appUser.is_active) {
      // Sign out the user if they are inactive
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
  }

  return NextResponse.redirect(new URL(next, request.url));
}
