-- Migration: Add is_archived column to faculty_classes
ALTER TABLE public.faculty_classes 
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_faculty_classes_archived 
  ON public.faculty_classes(faculty_profile_id, is_archived);
