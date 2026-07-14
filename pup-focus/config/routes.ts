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
