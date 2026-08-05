-- Migration: Add faculty_assignment_id to submissions table
-- Date: 2026-08-05
-- Description: Adds faculty_assignment_id foreign key column to public.submissions table if it does not already exist.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS faculty_assignment_id uuid REFERENCES public.faculty_program_assignments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_submissions_faculty_assignment ON public.submissions(faculty_assignment_id);
