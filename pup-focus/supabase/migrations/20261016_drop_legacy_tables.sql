-- Migration: Drop curricula table and all curriculum references
-- Purpose: Completely remove curriculum/curricula feature from the database

-- 1. Drop foreign key constraints on referencing tables
ALTER TABLE IF EXISTS public.compliance_template_items 
  DROP CONSTRAINT IF EXISTS compliance_template_items_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.faculty_program_assignments 
  DROP CONSTRAINT IF EXISTS faculty_program_assignments_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.submissions 
  DROP CONSTRAINT IF EXISTS submissions_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.programs 
  DROP CONSTRAINT IF EXISTS programs_curriculum_id_fkey;

-- 2. Drop any remaining curriculum_id columns
ALTER TABLE IF EXISTS public.compliance_template_items 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

ALTER TABLE IF EXISTS public.faculty_program_assignments 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

ALTER TABLE IF EXISTS public.submissions 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

ALTER TABLE IF EXISTS public.programs 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

-- 3. Drop indices related to curricula
DROP INDEX IF EXISTS public.idx_curricula_program_hidden;

-- 4. Drop the curricula table completely
DROP TABLE IF EXISTS public.curricula CASCADE;
