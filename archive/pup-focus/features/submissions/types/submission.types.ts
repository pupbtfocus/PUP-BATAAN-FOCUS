export type RequirementStatus =
  | "not_started"
  | "uploaded"
  | "under_review"
  | "revision_required"
  | "compliant"
  | "overdue";

export interface SubmissionDocumentVersion {
  id: string;
  submissionDocumentId: string;
  versionNumber: number;
  storagePath: string;
  checksumSha256: string;
  createdBy: string;
  createdAt: string;
}
