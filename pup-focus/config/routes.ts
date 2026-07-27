import { ROLE, type AppRole } from "@/config/roles";

export const ROUTE_BY_ROLE: Record<AppRole, string> = {
  [ROLE.SUPER_ADMIN]: "/super-admin/dashboard",
  [ROLE.FACULTY]: "/faculty/dashboard",
  [ROLE.PROGRAM_HEAD]: "/program-head/dashboard",
  [ROLE.ADMIN]: "/admin/dashboard",
};

export const AUTH_ROUTES = [
  "/sign-in",
  "/auth/sign-in",
  "/change-password",
  "/auth/change-password",
  "/forgot-password",
  "/auth/confirm",
];
/**
 * Maps a URL path prefix to the role(s) permitted to access routes under it.
 * Used by the middleware to enforce role-based route guards.
 */
export const ROLE_ROUTE_PREFIX: Record<string, AppRole[]> = {
  "/admin": [ROLE.ADMIN, ROLE.SUPER_ADMIN],
  "/faculty": [ROLE.FACULTY],
  "/program-head": [ROLE.PROGRAM_HEAD],
  "/super-admin": [ROLE.SUPER_ADMIN],
};

export const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/contact",
  "/api/auth/callback",
  "/api/bootstrap/super-admin",
  "/email-preview",
  "/api/email/preview",
  ...AUTH_ROUTES,
];
