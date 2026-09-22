"use server";

import {
  documentUploadSchema,
  type DocumentUploadInput,
} from "@/features/submissions/schemas/document-upload.schema";
import { logAuditEvent } from "@/features/audit-logs/services/audit-log.service";
import { getCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";

export async function uploadDocumentAction(payload: DocumentUploadInput) {
  const user = await getCurrentUser();

  if (!user) {
    logger.warn("upload_document_unauthorized", { reason: "no_session" });
    return { ok: false as const, error: "Unauthorized – please sign in." };
  }

  const input = documentUploadSchema.parse(payload);

  const storagePath = `compliance-private/${input.submissionId}/${input.requirementCode}`;

  logger.info("document_upload_recorded", {
    submissionId: input.submissionId,
    requirementCode: input.requirementCode,
    actorId: user.id,
  });

  // Audit log – fire-and-forget; failures are logged but never block the upload response
  try {
    await logAuditEvent({
      actorId: user.id,
      action: "submission.upload",
      entityType: "submission",
      entityId: input.submissionId,
      metadata: {
        submission_id: input.submissionId,
        requirement_code: input.requirementCode,
        storage_path: storagePath,
      },
    });
  } catch (auditError) {
    logger.error("audit_log_upload_action_failed", {
      submissionId: input.submissionId,
      error: auditError instanceof Error ? auditError.message : String(auditError),
    });
  }

  return {
    ok: true as const,
    storagePath,
  };
}

