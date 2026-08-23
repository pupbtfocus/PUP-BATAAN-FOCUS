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

