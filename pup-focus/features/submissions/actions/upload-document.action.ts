"use server";

import {
  documentUploadSchema,
  type DocumentUploadInput,
} from "@/features/submissions/schemas/document-upload.schema";
import { createNextVersion } from "@/features/submissions/services/document-version.service";
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

  const version = createNextVersion({
    submissionDocumentId: input.submissionId,
    storagePath: `compliance-private/${input.submissionId}/${input.requirementCode}`,
    checksumSha256: input.checksumSha256,
    actorId: user.id,
    latestVersionNumber: 0,
  });

  logger.info("document_upload_recorded", {
    submissionId: input.submissionId,
    requirementCode: input.requirementCode,
    versionNumber: version.versionNumber,
    actorId: user.id,
  });

  // Audit log – fire-and-forget; failures are logged but never block the upload response
  try {
    await logAuditEvent({
      actorId: user.id,
      action: "submission.upload",
      entityType: "document_version",
      entityId: version.id,
      metadata: {
        submission_id: input.submissionId,
        requirement_code: input.requirementCode,
        version_number: version.versionNumber,
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
    version,
  };
}

