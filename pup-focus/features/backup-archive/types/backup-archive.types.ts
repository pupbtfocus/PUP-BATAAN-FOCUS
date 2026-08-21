export type BackupStatus = "completed" | "failed" | "processing";

export interface SystemBackup {
  id: string;
  backup_name: string;
  academic_year?: string | null;
  total_records: number;
  file_size_kb: number;
  file_url?: string | null;
  status: BackupStatus;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  metadata?: {
    users_count?: number;
    terms_count?: number;
    submissions_count?: number;
    templates_count?: number;
    audit_logs_count?: number;
    description?: string;
  } | null;
}

export interface ArchivedTermSummary {
  academic_year: string;
  semester: string;
  status: string;
  is_archived: boolean;
  total_submissions: number;
  validated_submissions: number;
  archived_at?: string | null;
}

export interface AvailableAcademicTerm {
  academic_year: string;
  semester: string;
  status: string;
  is_archived: boolean;
  total_submissions?: number;
}

export interface BackupStats {
  total_backups: number;
  archived_academic_years: number;
  last_backup_date: string | null;
  total_archived_documents: number;
}

export interface BackupSnapshotData {
  version: string;
  exported_at: string;
  generated_by?: string;
  summary: {
    total_records: number;
    users_count: number;
    academic_terms_count: number;
    submissions_count: number;
    requirement_templates_count: number;
    audit_logs_count: number;
  };
  data: {
    users: unknown[];
    academic_terms: unknown[];
    submissions: unknown[];
    requirement_templates: unknown[];
    audit_logs: unknown[];
  };
}
