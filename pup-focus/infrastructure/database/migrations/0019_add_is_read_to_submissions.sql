-- Migration: Add is_read and viewed_at to submissions table
-- Description: Tracks whether faculty member has viewed their submission updates / reviewer remarks.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS is_read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_submissions_is_read ON public.submissions(is_read);
