import { getServiceRoleClient } from "@/lib/supabase/service-role";

/**
 * Canonical backup action names — all audit log entries use these keys.
 * This keeps the Audit Logs filter and search consistent across the system.
 */
export const AUDIT_ACTION = {
  // Backup & Archive
  BACKUP_CREATE: "backup.create",
  BACKUP_DOWNLOAD: "backup.download",
  BACKUP_EXPORT_ZIP: "backup.export_zip",
  BACKUP_DELETE: "backup.delete",

  // Requirement Templates
  TEMPLATE_CREATE: "template.create",
  TEMPLATE_UPDATE: "template.update",
  TEMPLATE_DELETE: "template.delete",

  // Submissions
  SUBMISSION_UPLOAD: "submission.upload",
  SUBMISSION_APPROVE: "submission.approve",
  SUBMISSION_REJECT: "submission.reject",
  SUBMISSION_REVIEW: "submission.review",

  // Documents
  DOCUMENT_UPLOAD: "document.upload",

  // User Management
  FACULTY_CREATE: "faculty.create",
  FACULTY_UPDATE: "faculty.update",
  USER_INVITE: "user.invite",
  USER_UPDATE: "user.update",
  USER_ACTIVATE: "user.activate",
  USER_DEACTIVATE: "user.deactivate",
  USER_DELETE: "user.delete",

  // Submission Windows
  SUBMISSION_WINDOW_UPDATE: "submission_window.update",
  SUBMISSION_WINDOW_CLOSE: "submission_window.close",
} as const;

export type AuditAction = (typeof AUDIT_ACTION)[keyof typeof AUDIT_ACTION];

interface LogAuditOptions {
  actorId: string | null;
  action: AuditAction | string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Insert an audit log entry. Never throws — failures are silently swallowed
 * so that a logging error never breaks the actual business operation.
 */
export async function logAudit(opts: LogAuditOptions): Promise<void> {
  try {
    const supabase = getServiceRoleClient();
    await supabase.from("audit_logs").insert({
      actor_id: opts.actorId,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId ?? null,
      metadata: opts.metadata ?? {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // Silently ignore — audit log failures must not affect the main operation
  }
}
