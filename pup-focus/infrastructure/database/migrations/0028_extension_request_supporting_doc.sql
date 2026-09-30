-- Migration: 0028_extension_request_supporting_doc.sql
-- Description: Adds supporting document and approved deadline columns to extension_requests.

ALTER TABLE public.extension_requests
  ADD COLUMN IF NOT EXISTS supporting_document_url text,
  ADD COLUMN IF NOT EXISTS supporting_document_name text,
  ADD COLUMN IF NOT EXISTS approved_date date,
  ADD COLUMN IF NOT EXISTS approved_time text;

-- Index on faculty_user_id and status for fast pending check
CREATE INDEX IF NOT EXISTS idx_extension_requests_pending_check
  ON public.extension_requests(faculty_user_id, academic_year, semester, status);
