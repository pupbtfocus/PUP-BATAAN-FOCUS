import { ROLE, type AppRole } from "@/config/roles";

const PERMISSIONS: Record<string, string[]> = {
  [ROLE.ADMIN]: ["*"],
  [ROLE.STAFF]: ["*"],
  [ROLE.FACULTY]: ["submission:create", "submission:view:own"],
  super_admin: ["*"],
};

export function hasPermission(role: AppRole | string, permission: string): boolean {
  const permissions = PERMISSIONS[role] ?? [];
  return permissions.includes("*") || permissions.includes(permission);
}
