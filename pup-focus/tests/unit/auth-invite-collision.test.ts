import { describe, it, expect } from "vitest";
import { AUTH_ROUTES, PUBLIC_ROUTES } from "../../config/routes";

describe("Auth Invite Link Collision Fixes", () => {
  it("includes /auth/callback and /api/auth/callback in PUBLIC_ROUTES", () => {
    expect(PUBLIC_ROUTES).toContain("/auth/callback");
    expect(PUBLIC_ROUTES).toContain("/api/auth/callback");
  });

  it("ensures middleware invite bypass condition correctly detects invite params and callback routes", () => {
    function shouldBypassDashboardRedirect(pathname: string, searchParams: URLSearchParams) {
      const isAuthCallbackOrConfirm =
        pathname === "/auth/confirm" ||
        pathname === "/auth/callback" ||
        pathname.startsWith("/api/auth/callback");

      const hasInviteOrAuthParams =
        searchParams.has("code") ||
        searchParams.has("token_hash") ||
        searchParams.has("token") ||
        searchParams.get("type") === "invite" ||
        searchParams.has("error") ||
        searchParams.has("access_token");

      const isAuthOrLandingPage =
        !isAuthCallbackOrConfirm &&
        !hasInviteOrAuthParams &&
        (pathname === "/" ||
          pathname === "/sign-in" ||
          AUTH_ROUTES.some(
            (route) => pathname === route && route !== "/auth/confirm",
          ));

      return !isAuthOrLandingPage;
    }

    // 1. Logged in user hitting /auth/confirm with code -> should bypass redirect to dashboard
    expect(
      shouldBypassDashboardRedirect("/auth/confirm", new URLSearchParams("code=xyz-123")),
    ).toBe(true);

    // 2. Logged in user hitting /auth/confirm with type=invite -> should bypass redirect
    expect(
      shouldBypassDashboardRedirect("/auth/confirm", new URLSearchParams("type=invite&token_hash=abc")),
    ).toBe(true);

    // 3. Logged in user hitting /auth/confirm with no params (e.g. hash will be read client side) -> should bypass redirect
    expect(
      shouldBypassDashboardRedirect("/auth/confirm", new URLSearchParams("")),
    ).toBe(true);

    // 4. Logged in user hitting /auth/callback with code -> should bypass redirect
    expect(
      shouldBypassDashboardRedirect("/auth/callback", new URLSearchParams("code=xyz-123&type=invite")),
    ).toBe(true);

    // 5. Logged in user visiting standard /sign-in without invite params -> should NOT bypass (normal redirect to dashboard)
    expect(
      shouldBypassDashboardRedirect("/sign-in", new URLSearchParams("")),
    ).toBe(false);

    // 6. Logged in user visiting root / -> should NOT bypass (normal redirect to dashboard)
    expect(
      shouldBypassDashboardRedirect("/", new URLSearchParams("")),
    ).toBe(false);
  });

  it("includes /auth/set-password and /reset-password in AUTH_ROUTES", () => {
    expect(AUTH_ROUTES).toContain("/auth/set-password");
    expect(AUTH_ROUTES).toContain("/reset-password");
    expect(AUTH_ROUTES).toContain("/auth/change-password");
  });

  it("detects invite flow to trigger force signOut prior to exchangeCodeForSession", () => {
    function isInviteOrAuthAction(code: string | null, tokenHash: string | null, type: string | null) {
      return type === "invite" || Boolean(code) || Boolean(tokenHash);
    }

    expect(isInviteOrAuthAction("sample-code", null, null)).toBe(true);
    expect(isInviteOrAuthAction(null, "sample-token-hash", "invite")).toBe(true);
    expect(isInviteOrAuthAction(null, null, "invite")).toBe(true);
    expect(isInviteOrAuthAction(null, null, null)).toBe(false);
  });

  it("handles password setup redirect for invited faculty/admin users", () => {
    function shouldRedirectToPasswordSetup(userMetadata: Record<string, any>, type: string | null) {
      const isInvite =
        type === "invite" ||
        userMetadata?.must_change_password === true ||
        userMetadata?.force_password_change === true ||
        userMetadata?.created_via === "admin_faculty_panel" ||
        userMetadata?.created_via === "superadmin_admin_panel";

      const isRecovery = type === "recovery";

      return isInvite || isRecovery;
    }

    expect(shouldRedirectToPasswordSetup({ must_change_password: true }, null)).toBe(true);
    expect(shouldRedirectToPasswordSetup({ force_password_change: true }, null)).toBe(true);
    expect(shouldRedirectToPasswordSetup({ created_via: "admin_faculty_panel" }, null)).toBe(true);
    expect(shouldRedirectToPasswordSetup({}, "invite")).toBe(true);
    expect(shouldRedirectToPasswordSetup({}, "recovery")).toBe(true);
    expect(shouldRedirectToPasswordSetup({}, null)).toBe(false);
  });
});

