import { NextResponse, type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import {
  AUTH_ROUTES,
  PUBLIC_ROUTES,
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

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ── 1. Public routes: pass through without touching the session. ──
  if (PUBLIC_ROUTES.some((route) => pathname === route)) {
    return NextResponse.next();
  }

  // ── 2. Refresh the Supabase session & resolve the user. ──
  const { response, user } = await updateSupabaseSession(request);
  const role: AppRole =
    (user?.user_metadata?.role as AppRole | undefined) ?? ROLE.FACULTY;
  const roleDashboard = ROUTE_BY_ROLE[role];

  // ── 3. Authenticated user visiting an auth page → redirect to dashboard. ──
  if (user && AUTH_ROUTES.some((route) => pathname === route)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = roleDashboard;
    return NextResponse.redirect(redirectUrl);
  }

  // ── 4. Unauthenticated user on a protected route → redirect to sign-in. ──
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/sign-in";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ── 5. Role-based route guard. ──
  const matchedPrefix = matchProtectedPrefix(pathname);

  if (matchedPrefix) {
    const allowedRoles = ROLE_ROUTE_PREFIX[matchedPrefix];

    if (!allowedRoles.includes(role)) {
      // User is authenticated but accessing a route outside their role.
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = roleDashboard;
      redirectUrl.searchParams.set("unauthorized", "1");
      return NextResponse.redirect(redirectUrl);
    }
  }

  // ── 6. All checks passed – forward the (cookie-refreshed) response. ──
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

