import type { AuditRecord } from "@/types/global";

export function createAuditRecord(
  params: Omit<AuditRecord, "id" | "createdAt">,
): AuditRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...params,
  };
}
