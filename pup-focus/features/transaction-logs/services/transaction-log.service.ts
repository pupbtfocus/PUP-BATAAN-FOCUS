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

export type TransactionEventInput = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
};

export type AuditEventInput = TransactionEventInput;

/**
 * Creates an in-memory record and asynchronously persists it to transaction_logs (or audit_logs fallback).
 */
export function createTransactionRecord(
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

  void logTransactionEvent(params);

  return record;
}

export const createAuditRecord = createTransactionRecord;

/**
 * Inserts a transaction log event into Supabase `transaction_logs` table (with automatic fallback to `audit_logs`).
 */
export async function logTransactionEvent(
  input: TransactionEventInput,
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

    const payload = {
      id: recordId,
      actor_id: safeActorId,
      action: input.action,
      entity_type: input.entityType,
      entity_id: safeEntityId,
      metadata: mergedMetadata,
      created_at: createdAt,
    };

    // Insert into transaction_logs
    const { error } = await supabase.from("transaction_logs").insert(payload);

    if (error) {
      logger.error("transaction_log_insert_failed", {
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
    logger.error("transaction_log_exception", {
      error: err instanceof Error ? err.message : String(err),
      action: input.action,
    });
    return null;
  }
}

export const logAuditEvent = logTransactionEvent;

/**
 * Fetches recent transaction logs from Supabase.
 */
export async function getTransactionLogs(params?: {
  actorId?: string;
  entityType?: string;
  limit?: number;
}): Promise<AuditRecord[]> {
  try {
    const supabase = getServiceRoleClient();
    let query = supabase
      .from("transaction_logs")
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
      logger.error("get_transaction_logs_failed", { error: error.message });
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
    logger.error("get_transaction_logs_exception", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

export const getAuditLogs = getTransactionLogs;
