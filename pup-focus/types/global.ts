import type { AppRole } from "@/config/roles";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  department_id?: string | null;
  created_at: string;
  updated_at: string;
  user_roles?: UserRoleRecord[];
}

export interface UserRoleRecord {
  id: string;
  profile_id: string;
  role_id: string;
  created_at: string;
  roles?: {
    id?: string;
    code: AppRole | string;
    name: string;
  };
}

/**
 * @deprecated Legacy app_users table is deprecated. Use `Profile` and `UserRoleRecord` instead.
 */
export interface AppUser {
  id: string;
  auth_user_id?: string;
  profile_id?: string;
  email: string;
  full_name?: string;
  role: AppRole | string;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AuditRecord {
  id: string;
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

