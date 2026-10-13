-- ==============================================================================
-- Migration: Create faculty_classes table & update submissions table
-- Date: 2026-10-14
-- Description:
-- 1. Creates public.faculty_classes table for subject/class loads per academic term.
-- 2. Adds class_id column to public.submissions table.
-- 3. Configures RLS policies, indexes, and constraints.
-- ==============================================================================

-- 1. Create faculty_classes table if it does not exist
CREATE TABLE IF NOT EXISTS public.faculty_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_profile_id UUID NOT NULL,
  academic_term_id UUID,
  subject_code VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  units NUMERIC(3, 1) NOT NULL DEFAULT 3.0,
  section_code VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Establish Foreign Keys safely
DO $$
BEGIN
  -- Foreign key for faculty_profile_id: check faculty_profiles, then profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faculty_profiles') THEN
    ALTER TABLE public.faculty_classes DROP CONSTRAINT IF EXISTS faculty_classes_faculty_profile_id_fkey;
    ALTER TABLE public.faculty_classes
      ADD CONSTRAINT faculty_classes_faculty_profile_id_fkey
      FOREIGN KEY (faculty_profile_id) REFERENCES public.faculty_profiles(id) ON DELETE CASCADE;
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.faculty_classes DROP CONSTRAINT IF EXISTS faculty_classes_faculty_profile_id_fkey;
    ALTER TABLE public.faculty_classes
      ADD CONSTRAINT faculty_classes_faculty_profile_id_fkey
      FOREIGN KEY (faculty_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  -- Foreign key for academic_term_id (only if academic_terms has an id column)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'academic_terms' AND column_name = 'id'
  ) THEN
    ALTER TABLE public.faculty_classes DROP CONSTRAINT IF EXISTS faculty_classes_academic_term_id_fkey;
    ALTER TABLE public.faculty_classes
      ADD CONSTRAINT faculty_classes_academic_term_id_fkey
      FOREIGN KEY (academic_term_id) REFERENCES public.academic_terms(id) ON DELETE CASCADE;
  END IF;

  -- 3. Add class_id to submissions table if not present
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submissions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'class_id'
    ) THEN
      ALTER TABLE public.submissions ADD COLUMN class_id UUID REFERENCES public.faculty_classes(id) ON DELETE CASCADE;
    ELSE
      -- Ensure foreign key constraint exists with ON DELETE CASCADE
      ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_class_id_fkey;
      ALTER TABLE public.submissions
        ADD CONSTRAINT submissions_class_id_fkey
        FOREIGN KEY (class_id) REFERENCES public.faculty_classes(id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 4. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_faculty_classes_faculty_term ON public.faculty_classes(faculty_profile_id, academic_term_id);
CREATE INDEX IF NOT EXISTS idx_faculty_classes_subject_section ON public.faculty_classes(subject_code, section_code);
CREATE INDEX IF NOT EXISTS idx_submissions_class_id ON public.submissions(class_id);

-- 5. Row Level Security (RLS)
ALTER TABLE public.faculty_classes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'faculty_classes' AND policyname = 'faculty_classes_all'
  ) THEN
    CREATE POLICY faculty_classes_all ON public.faculty_classes FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 6. Permissions
GRANT ALL ON public.faculty_classes TO authenticated, service_role;
