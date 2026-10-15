-- Migration 0033: Clean up all legacy curriculum triggers and columns
-- Description:
--   1. Drops the trigger on faculty_program_assignments that references non-existent curriculum_id.
--   2. Drops leftover curriculum_id columns if present.
--   3. Reloads PostgREST schema cache.

-- 1. Drop broken trigger that references curriculum_id
DROP TRIGGER IF EXISTS set_faculty_program_assignments_defaults ON public.faculty_program_assignments;
DROP FUNCTION IF EXISTS public.trg_faculty_program_assignments_defaults();

-- 2. Drop legacy curriculum_id columns if they exist
ALTER TABLE IF EXISTS public.submissions DROP COLUMN IF EXISTS curriculum_id CASCADE;
ALTER TABLE IF EXISTS public.faculty_program_assignments DROP COLUMN IF EXISTS curriculum_id CASCADE;

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
