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

export interface DocumentVersionDetail {
  id: string;
  versionNumber: number;
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  downloadUrl: string;
}

export interface VersionHistoryResponse {
  versions: DocumentVersionDetail[];
  submission: {
    id: string;
    requirementCode: string;
    status: string;
    feedback?: string;
    reviewedAt?: string;
  };
}
