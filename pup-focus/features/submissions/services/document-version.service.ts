import type { SubmissionDocumentVersion } from "@/features/submissions/types/submission.types";

export type VersioningInput = {
  submissionDocumentId: string;
  storagePath: string;
  checksumSha256: string;
  actorId: string;
  latestVersionNumber: number;
};

export function createNextVersion(
  input: VersioningInput,
): SubmissionDocumentVersion {
  return {
    id: crypto.randomUUID(),
    submissionDocumentId: input.submissionDocumentId,
    versionNumber: input.latestVersionNumber + 1,
    storagePath: input.storagePath,
    checksumSha256: input.checksumSha256,
    createdBy: input.actorId,
    createdAt: new Date().toISOString(),
  };
}
