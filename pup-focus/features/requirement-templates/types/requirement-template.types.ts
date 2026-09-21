export type AllowedFormat = "PDF" | "DOCX" | "XLSX" | "PNG" | "JPG" | "ZIP";

export const ALLOWED_FORMAT_OPTIONS: { label: string; value: AllowedFormat; mimeType: string }[] = [
  { label: "PDF Document", value: "PDF", mimeType: "application/pdf" },
  { label: "Word (DOCX)", value: "DOCX", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  { label: "Excel (XLSX)", value: "XLSX", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  { label: "PNG Image", value: "PNG", mimeType: "image/png" },
  { label: "JPG Image", value: "JPG", mimeType: "image/jpeg" },
  { label: "ZIP Archive", value: "ZIP", mimeType: "application/zip" },
];

export const MAX_SIZE_OPTIONS: { label: string; value: number }[] = [
  { label: "2 MB", value: 2 },
  { label: "5 MB", value: 5 },
  { label: "10 MB", value: 10 },
  { label: "20 MB", value: 20 },
  { label: "25 MB", value: 25 },
  { label: "50 MB", value: 50 },
];

export interface RequirementTemplate {
  id: string;
  title: string;
  code: string;
  description?: string | null;
  allowed_formats: AllowedFormat[];
  max_size_mb: number;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RequirementTemplateFormInput {
  title: string;
  code: string;
  description?: string;
  allowed_formats: AllowedFormat[];
  max_size_mb: number;
  is_mandatory: boolean;
  is_active?: boolean;
}
