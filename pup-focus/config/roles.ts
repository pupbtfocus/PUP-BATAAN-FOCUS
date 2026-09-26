export const ROLE = {
  SUPER_ADMIN: "super_admin",
  FACULTY: "faculty",
  ADMIN: "admin",
} as const;

export type AppRole = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<AppRole, string> = {
  [ROLE.SUPER_ADMIN]: "Super Admin",
  [ROLE.FACULTY]: "Faculty",
  [ROLE.ADMIN]: "Admin",
};

export const ORIGINAL_SUPER_ADMIN_EMAIL = "pupbataanfocus.superadmin@gmail.com";

export function isOriginalSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ORIGINAL_SUPER_ADMIN_EMAIL.toLowerCase();
}

export function isQaSuperAdmin(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase().trim();
  return (
    normalized === "qa.superadmin1@pupfocus.dev" ||
    normalized === "qa.superadmin2@pupfocus.dev" ||
    (normalized.startsWith("qa.superadmin") && normalized.endsWith("@pupfocus.dev"))
  );
}

export function canManageAdminAccount(params: {
  targetEmail?: string | null;
  targetRole?: string | null;
  actorEmail?: string | null;
  action?: "edit" | "deactivate" | "delete";
}): boolean {
  const targetEmail = params.targetEmail?.toLowerCase().trim();
  const actorEmail = params.actorEmail?.toLowerCase().trim();
  const isTargetSuper = (params.targetRole || "").toLowerCase().includes("super");

  // The original primary Super Admin cannot be deactivated or deleted
  if (targetEmail === ORIGINAL_SUPER_ADMIN_EMAIL.toLowerCase()) {
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

  // Regular admins can be managed by any authorized admin manager
  if (!isTargetSuper) {
    return true;
  }

  // QA SuperAdmins can be edited, deactivated, and deleted by the original Super Admin
  if (isQaSuperAdmin(targetEmail)) {
    return isOriginalSuperAdmin(actorEmail);
  }

  return false;
}

