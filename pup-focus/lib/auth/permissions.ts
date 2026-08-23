import { ROLE, type AppRole } from "@/config/roles";

const PERMISSIONS: Record<AppRole, string[]> = {
  [ROLE.SUPER_ADMIN]: ["*"],
  [ROLE.FACULTY]: ["submission:create", "submission:view:own"],
  [ROLE.ADMIN]: ["*"],
};

export function hasPermission(role: AppRole, permission: string): boolean {
  const permissions = PERMISSIONS[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
