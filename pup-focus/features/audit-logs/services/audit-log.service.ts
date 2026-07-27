import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { logger } from "@/lib/observability/logger";
import type { AuditRecord } from "@/types/global";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureValidUuid(id: string): string {
  if (UUID_REGEX.test(id)) {
    return id;
  }
  return crypto.randomUUID();
}

export type AuditEventInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

/**
 * Creates an in-memory AuditRecord object and asynchronously persists it to Supabase audit_logs.
 * Resilient to database failures – logs errors without throwing exceptions to callers.
 */
export function createAuditRecord(
  params: Omit<AuditRecord, "id" | "createdAt"> & { details?: Record<string, unknown> },
): AuditRecord {
  const recordId = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  const record: AuditRecord = {
    id: recordId,
    actorId: params.actorId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    metadata: params.metadata ?? params.details ?? {},
    createdAt,
  };

  // Fire and forget persistence asynchronously
  void logAuditEvent(params);

  return record;
}

/**
 * Inserts an audit log event directly into the Supabase `audit_logs` table.
 * Fully safe and resilient – catches and logs all errors without throwing.
 */
export async function logAuditEvent(
  input: AuditEventInput,
): Promise<AuditRecord | null> {
  const recordId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const safeActorId = ensureValidUuid(input.actorId);
  const safeEntityId = ensureValidUuid(input.entityId);

  const mergedMetadata = {
    ...(input.metadata ?? {}),
    ...(input.details ?? {}),
    ...(input.actorId !== safeActorId ? { raw_actor_id: input.actorId } : {}),
    ...(input.entityId !== safeEntityId ? { raw_entity_id: input.entityId } : {}),
  };

  try {
    const supabase = getServiceRoleClient();

    const { error } = await supabase.from("audit_logs").insert({
      id: recordId,
      actor_id: safeActorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: safeEntityId,
      metadata: mergedMetadata,
      created_at: createdAt,
    });

    if (error) {
      logger.error("audit_log_insert_failed", {
        error: error.message,
        action: input.action,
        actorId: input.actorId,
      });
      return null;
    }

    return {
      id: recordId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: mergedMetadata,
      createdAt,
    };
  } catch (err) {
    logger.error("audit_log_exception", {
      error: err instanceof Error ? err.message : String(err),
      action: input.action,
    });
    return null;
  }
}

/**
 * Fetches recent audit log records from Supabase.
 */
export async function getAuditLogs(params?: {
  actorId?: string;
  entityType?: string;
  limit?: number;
}): Promise<AuditRecord[]> {
  try {
    const supabase = getServiceRoleClient();
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(params?.limit ?? 50);

    if (params?.actorId) {
      query = query.eq("actor_id", ensureValidUuid(params.actorId));
    }

    if (params?.entityType) {
      query = query.eq("entity_type", params.entityType);
    }

    const { data, error } = await query;

    if (error) {
      logger.error("get_audit_logs_failed", { error: error.message });
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      actorId: row.actor_id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }));
  } catch (err) {
    logger.error("get_audit_logs_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
