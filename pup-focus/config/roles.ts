export const ROLE = {
  ADMIN: "admin",
  FACULTY: "faculty",
  STAFF: "staff",
  // Backward compatibility alias during migration
  SUPER_ADMIN: "admin",
} as const;

export type AppRole = "admin" | "faculty" | "staff" | "super_admin";

export const ROLE_LABEL: Record<string, string> = {
  [ROLE.ADMIN]: "Admin",
  [ROLE.FACULTY]: "Faculty",
  [ROLE.STAFF]: "Staff",
  super_admin: "Admin",
};

export const ORIGINAL_ADMIN_EMAIL = "pupbataanfocus.admin@gmail.com";
export const ORIGINAL_SUPER_ADMIN_EMAIL = "pupbataanfocus.superadmin@gmail.com";

export function isOriginalAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === ORIGINAL_ADMIN_EMAIL.toLowerCase() ||
    normalized === ORIGINAL_SUPER_ADMIN_EMAIL.toLowerCase()
  );
}

export const isOriginalSuperAdmin = isOriginalAdmin;

export function isAdminRoleToken(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return (
    r === ROLE.ADMIN ||
    r === ROLE.SUPER_ADMIN ||
    r === "super_admin" ||
    r === "superadmin"
  );
}

/**
 * Resolves the trusted effective role for an authenticated user.
 * Prefers server-controlled `app_metadata.role` and prevents client-mutable
 * `user_metadata.role` from elevating an account to Admin.
 */
export function resolveTrustedUserRole(
  user?: {
    email?: string | null;
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
  } | null,
): string | undefined {
  if (!user) return undefined;
  if (isOriginalAdmin(user.email) || isQaAdmin(user.email)) {
    return ROLE.ADMIN;
  }

  const appRole =
    typeof user.app_metadata?.role === "string"
      ? user.app_metadata.role.trim()
      : "";
  if (appRole) {
    return appRole;
  }

  const userRole =
    typeof user.user_metadata?.role === "string"
      ? user.user_metadata.role.trim()
      : "";
  if (!userRole) {
    return undefined;
  }

  // Never allow client-mutable user_metadata alone to grant Admin privileges.
  if (isAdminRoleToken(userRole)) {
    return ROLE.STAFF;
  }

  return userRole;
}

export function isQaAdmin(email?: string | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === "qa.admin1@pupfocus.dev" ||
    normalized === "qa.admin2@pupfocus.dev" ||
    (normalized.startsWith("qa.admin") && normalized.endsWith("@pupfocus.dev")) ||
    normalized === "qa.superadmin1@pupfocus.dev" ||
    normalized === "qa.superadmin2@pupfocus.dev" ||
    (normalized.startsWith("qa.superadmin") && normalized.endsWith("@pupfocus.dev"))
  );
}

export const isQaSuperAdmin = isQaAdmin;

export function isQaStaff(email?: string | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized.startsWith("qa.staff") && normalized.endsWith("@pupfocus.dev")
  );
}

export function isQaFaculty(email?: string | null): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === "qa.faculty1@pupfocus.dev" ||
    normalized === "qa.faculty2@pupfocus.dev" ||
    (normalized.startsWith("qa.faculty") && normalized.endsWith("@pupfocus.dev"))
  );
}

export function canManageStaffAccount(params: {
  targetEmail?: string | null;
  targetRole?: string | null;
  actorEmail?: string | null;
  action?: "edit" | "deactivate" | "delete";
}): boolean {
  const targetEmail = params.targetEmail?.toLowerCase().trim();
  const actorEmail = params.actorEmail?.toLowerCase().trim();
  const targetRole = (params.targetRole || "").toLowerCase();

  // The original primary Admin cannot be deactivated or deleted
  if (isOriginalAdmin(targetEmail)) {
    return false;
  }

  // Prevent self-deactivation and self-deletion
  if (
    (params.action === "deactivate" || params.action === "delete") &&
    actorEmail &&
    targetEmail === actorEmail
  ) {
    return false;
  }

  // Primary Admin can manage all staff/admin accounts
  if (isOriginalAdmin(actorEmail)) {
    return true;
  }

  // Staff accounts can be managed by any authorized manager
  const isTargetSuperAdmin =
    targetRole.includes("super") ||
    Boolean(targetEmail && targetEmail.startsWith("qa.superadmin"));

  if (!isTargetSuperAdmin) {
    return true;
  }

  return false;
}

export const canManageAdminAccount = canManageStaffAccount;
