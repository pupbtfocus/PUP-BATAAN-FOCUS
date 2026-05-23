import type { AppRole } from "@/config/roles";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  fullName: string;
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
