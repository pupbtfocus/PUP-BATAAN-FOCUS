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
  version_number?: number;
  storagePath: string;
  file_path?: string;
  fileName: string;
  file_name?: string;
  mimeType?: string;
  sizeBytes: number;
  size_bytes?: number;
  sizeFormatted?: string;
  size_formatted?: string;
  checksumSha256?: string;
  createdAt: string;
  created_at?: string;
  downloadUrl: string;
  download_url?: string;
  status?: string | null;
  remarks?: string | null;
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
