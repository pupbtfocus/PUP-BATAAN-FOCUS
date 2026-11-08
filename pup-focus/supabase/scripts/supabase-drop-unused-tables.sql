-- Run this in Supabase SQL Editor to remove curricula and all curriculum references
ALTER TABLE IF EXISTS public.compliance_template_items 
  DROP CONSTRAINT IF EXISTS compliance_template_items_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.faculty_program_assignments 
  DROP CONSTRAINT IF EXISTS faculty_program_assignments_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.submissions 
  DROP CONSTRAINT IF EXISTS submissions_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.programs 
  DROP CONSTRAINT IF EXISTS programs_curriculum_id_fkey;

ALTER TABLE IF EXISTS public.compliance_template_items 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

ALTER TABLE IF EXISTS public.faculty_program_assignments 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

ALTER TABLE IF EXISTS public.submissions 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

ALTER TABLE IF EXISTS public.programs 
  DROP COLUMN IF EXISTS curriculum_id CASCADE;

DROP INDEX IF EXISTS public.idx_curricula_program_hidden;

DROP TABLE IF EXISTS public.curricula CASCADE;
