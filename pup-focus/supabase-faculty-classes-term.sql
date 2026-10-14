-- 1. Ensure public.academic_terms has an id UUID column
ALTER TABLE public.academic_terms 
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Populate UUID for any existing academic_terms that don't have one
UPDATE public.academic_terms 
SET id = gen_random_uuid() 
WHERE id IS NULL;

-- Ensure id is unique and non-null
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'academic_terms_id_unique'
  ) THEN
    ALTER TABLE public.academic_terms ADD CONSTRAINT academic_terms_id_unique UNIQUE (id);
  END IF;
END $$;

-- 2. Ensure public.faculty_classes has academic_term_id, academic_year, and semester
ALTER TABLE public.faculty_classes 
  ADD COLUMN IF NOT EXISTS academic_term_id UUID,
  ADD COLUMN IF NOT EXISTS academic_year VARCHAR(20),
  ADD COLUMN IF NOT EXISTS semester VARCHAR(50);

-- 3. Backfill academic_term_id, academic_year, and semester in faculty_classes
-- from the active ('Current') or latest academic term
UPDATE public.faculty_classes fc
SET 
  academic_term_id = COALESCE(fc.academic_term_id, at.id),
  academic_year    = COALESCE(fc.academic_year, at.academic_year),
  semester         = COALESCE(fc.semester, at.semester)
FROM (
  SELECT id, academic_year, semester 
  FROM public.academic_terms 
  ORDER BY (status = 'Current') DESC, academic_year DESC 
  LIMIT 1
) at;

-- 4. Re-link foreign key constraints cleanly
DO $$
BEGIN
  ALTER TABLE public.faculty_classes DROP CONSTRAINT IF EXISTS faculty_classes_academic_term_id_fkey;
  ALTER TABLE public.faculty_classes
    ADD CONSTRAINT faculty_classes_academic_term_id_fkey
    FOREIGN KEY (academic_term_id) 
    REFERENCES public.academic_terms(id) 
    ON DELETE SET NULL;
END $$;

-- 5. Return the updated rows to verify immediately in Supabase results
SELECT 
  id, 
  faculty_profile_id, 
  subject_code, 
  section_code, 
  academic_term_id, 
  academic_year, 
  semester, 
  created_at
FROM public.faculty_classes;
