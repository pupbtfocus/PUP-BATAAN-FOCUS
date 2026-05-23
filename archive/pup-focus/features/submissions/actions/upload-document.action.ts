"use server";

import {
  documentUploadSchema,
  type DocumentUploadInput,
} from "@/features/submissions/schemas/document-upload.schema";
import { createNextVersion } from "@/features/submissions/services/document-version.service";
import { logger } from "@/lib/observability/logger";

export async function uploadDocumentAction(payload: DocumentUploadInput) {
  const input = documentUploadSchema.parse(payload);

  const version = createNextVersion({
    submissionDocumentId: input.submissionId,
    storagePath: `compliance-private/${input.submissionId}/${input.requirementCode}`,
    checksumSha256: input.checksumSha256,
    actorId: "pending-auth-user",
    latestVersionNumber: 0,
  });

  logger.info("document_upload_recorded", {
    submissionId: input.submissionId,
    requirementCode: input.requirementCode,
    versionNumber: version.versionNumber,
  });

  return {
    ok: true,
    version,
  };
}
