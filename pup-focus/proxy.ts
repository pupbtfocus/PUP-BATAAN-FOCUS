import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import {
  AUTH_ROUTES,
  ROLE_ROUTE_PREFIX,
  ROUTE_BY_ROLE,
} from "@/config/routes";
import { ROLE, type AppRole } from "@/config/roles";

/**
 * Determines the role-gated path prefix the current pathname falls under.
 * Returns `null` when the pathname does not match any protected prefix.
 */
function matchProtectedPrefix(pathname: string): string | null {
  // Sort by length descending so `/super-admin` is checked before `/admin`.
  const prefixes = Object.keys(ROLE_ROUTE_PREFIX).sort(
    (a, b) => b.length - a.length,
  );

  for (const prefix of prefixes) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return prefix;
    }
  }

  return null;
}

/**
 * Safely resolves the user's role from user_metadata, app_metadata,
 * or database profile (`profiles` + `user_roles`), falling back to `ROLE.FACULTY`.
 */
async function getUserRole(
  user: User,
  supabase: SupabaseClient | null,
): Promise<AppRole> {
  const validRoles = Object.values(ROLE) as AppRole[];

  const userMetaRole = user.user_metadata?.role as AppRole | undefined;
  if (userMetaRole && validRoles.includes(userMetaRole)) {
    return userMetaRole;
  }

  const appMetaRole = user.app_metadata?.role as AppRole | undefined;
  if (appMetaRole && validRoles.includes(appMetaRole)) {
    return appMetaRole;
  }

  if (supabase) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, user_roles(roles(code))")
        .eq("user_id", user.id)
        .maybeSingle();

      const userRoles = profile?.user_roles as Array<{ roles: { code: string } | null }> | undefined;
      const roleCode = userRoles?.[0]?.roles?.code;

      if (roleCode && validRoles.includes(roleCode as AppRole)) {
        return roleCode as AppRole;
      }
    } catch {
      // Ignore database lookup errors and fall back to default
    }
  }

  return ROLE.FACULTY;
}

/**
 * Creates a redirect response, forwarding any updated session cookies from
 * the original Supabase middleware response.
 */
function createRedirectResponse(
  request: NextRequest,
  targetPath: string,
  searchParams?: Record<string, string>,
  baseResponse?: NextResponse,
): NextResponse {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = targetPath;

  if (searchParams) {
    redirectUrl.search = "";
    Object.entries(searchParams).forEach(([key, value]) => {
      redirectUrl.searchParams.set(key, value);
    });
  }

  const redirectResponse = NextResponse.redirect(redirectUrl);

  if (baseResponse) {
    baseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
  }

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;

  // 1. Refresh Supabase auth session & retrieve user + client
  const { response, user, supabase } = await updateSupabaseSession(request);

  // 2. Retrieve user's role if authenticated
  let userRole: AppRole | null = null;
  if (user) {
    userRole = await getUserRole(user, supabase);
  }

  const roleDashboard = userRole ? ROUTE_BY_ROLE[userRole] : "/";

  // 3. Public Route Handling: If authenticated user visits `/` or `/sign-in` (or auth sign-in pages),
  // automatically redirect them to their designated role dashboard, UNLESS they are accessing
  // an auth callback or confirmation flow (e.g. invite links, token verification).
  const isAuthCallbackOrConfirm =
    pathname === "/auth/confirm" ||
    pathname === "/auth/callback" ||
    pathname.startsWith("/api/auth/callback");

  const hasInviteOrAuthParams =
    request.nextUrl.searchParams.has("code") ||
    request.nextUrl.searchParams.has("token_hash") ||
    request.nextUrl.searchParams.has("token") ||
    request.nextUrl.searchParams.get("type") === "invite" ||
    request.nextUrl.searchParams.has("error") ||
    request.nextUrl.searchParams.has("access_token");

  const isAuthOrLandingPage =
    !isAuthCallbackOrConfirm &&
    !hasInviteOrAuthParams &&
    (pathname === "/" ||
      pathname === "/sign-in" ||
      AUTH_ROUTES.some(
        (route) => pathname === route && route !== "/auth/confirm",
      ));

  if (user) {
    const mustChangePassword =
      user.user_metadata?.must_change_password === true ||
      user.user_metadata?.force_password_change === true;

    const isChangePasswordPage =
      pathname === "/auth/change-password" || pathname === "/change-password";

    if (
      mustChangePassword &&
      !isChangePasswordPage &&
      !isAuthCallbackOrConfirm &&
      !hasInviteOrAuthParams &&
      !pathname.startsWith("/api")
    ) {
      return createRedirectResponse(
        request,
        "/auth/change-password",
        undefined,
        response,
      );
    }

    if (mustChangePassword && isChangePasswordPage) {
      return response;
    }
  }

  if (user && isAuthOrLandingPage) {
    return createRedirectResponse(request, roleDashboard, undefined, response);
  }

  // 4. Session & Auth Guard / Role Verification for protected routes
  const matchedPrefix = matchProtectedPrefix(pathname);

  if (matchedPrefix) {
    // 4a. If no valid Supabase auth session exists, redirect immediately to `/` with `redirectedFrom` param.
    if (!user) {
      const fullPath = `${pathname}${search}`;
      return createRedirectResponse(
        request,
        "/",
        { redirectedFrom: fullPath },
        response,
      );
    }

    // 4b. Prevent unauthorized role access
    const allowedRoles = ROLE_ROUTE_PREFIX[matchedPrefix];
    if (userRole && !allowedRoles.includes(userRole)) {
      return createRedirectResponse(
        request,
        roleDashboard,
        { unauthorized: "1" },
        response,
      );
    }
  }

  // 5. Unrestricted access for public routes or authorized role access
  return response;
}

export const middleware = proxy;
export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
