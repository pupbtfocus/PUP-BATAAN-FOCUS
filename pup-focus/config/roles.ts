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

export function isQaAdmin(email?: string | null): boolean {
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

export function isQaFaculty(email?: string | null): boolean {
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
  const isTargetAdmin = targetRole.includes("super") || targetRole === "admin";

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

  // Staff can be managed by any authorized manager
  if (!isTargetAdmin) {
    return true;
  }

  // QA Admins can be edited, deactivated, and deleted by original Admin
  if (isQaAdmin(targetEmail)) {
    return isOriginalAdmin(actorEmail);
  }

  return false;
}

export const canManageAdminAccount = canManageStaffAccount;
