export const ROLE = {
  SUPER_ADMIN: "super_admin",
  FACULTY: "faculty",
  PROGRAM_HEAD: "program_head",
  ADMIN: "admin",
} as const;

export type AppRole = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABEL: Record<AppRole, string> = {
  [ROLE.SUPER_ADMIN]: "Super Admin",
  [ROLE.FACULTY]: "Faculty",
  [ROLE.PROGRAM_HEAD]: "Program Head",
  [ROLE.ADMIN]: "Admin",
};
