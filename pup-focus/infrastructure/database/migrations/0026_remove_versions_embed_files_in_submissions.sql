-- ====================================================================
-- Migration: 0026_remove_versions_embed_files_in_submissions.sql
-- Description: Embed document file metadata directly into submissions table
--              and remove document versioning.
-- ====================================================================

-- 1. Add file columns directly to public.submissions
ALTER TABLE public.submissions 
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS file_name text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes bigint,
  ADD COLUMN IF NOT EXISTS checksum_sha256 text;

-- 2. Backfill file metadata from document_versions into submissions
UPDATE public.submissions s
SET 
  storage_path = dv.storage_path,
  mime_type = dv.mime_type,
  size_bytes = dv.size_bytes,
  checksum_sha256 = dv.checksum_sha256
FROM (
  SELECT DISTINCT ON (submission_id)
    submission_id,
    storage_path,
    mime_type,
    size_bytes,
    checksum_sha256
  FROM public.document_versions
  ORDER BY submission_id, version_number DESC, created_at DESC
) dv
WHERE s.id = dv.submission_id;

-- 3. Delete old duplicate versions if any existed, leaving only 1 record per submission
DELETE FROM public.document_versions
WHERE id NOT IN (
  SELECT DISTINCT ON (submission_id) id
  FROM public.document_versions
  ORDER BY submission_id, version_number DESC, created_at DESC
);

-- 4. Set all remaining version_number to 1
UPDATE public.document_versions SET version_number = 1;

-- 5. Drop document_versions table (uncomment when all code points directly to submissions)
-- DROP TABLE IF EXISTS public.document_versions CASCADE;
