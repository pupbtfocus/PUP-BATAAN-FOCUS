DO $$
DECLARE
  v_admin_id UUID;
  v_curriculum_id UUID;
  v_default_due TIMESTAMPTZ;
BEGIN
  -- 1. Resolve Admin Profile ID safely
  SELECT COALESCE(
    (SELECT a.profile_id FROM public.admins a LIMIT 1),
    (SELECT ur.profile_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code ILIKE '%admin%' OR r.code ILIKE '%head%' LIMIT 1),
    (SELECT p.id FROM public.profiles p LIMIT 1)
  ) INTO v_admin_id;

  -- 2. Resolve Curriculum ID
  SELECT id INTO v_curriculum_id 
  FROM public.curricula 
  ORDER BY is_active DESC, created_at ASC 
  LIMIT 1;

  -- 3. Resolve Due Date safely using end_date from submission_windows
  BEGIN
    SELECT COALESCE(
      (SELECT (end_date::text || ' ' || COALESCE(end_time::text, '23:59:59'))::timestamptz FROM public.submission_windows ORDER BY created_at DESC LIMIT 1),
      (SELECT end_date::timestamptz FROM public.submission_windows ORDER BY created_at DESC LIMIT 1)
    ) INTO v_default_due;
  EXCEPTION WHEN OTHERS THEN
    v_default_due := NOW() + INTERVAL '7 days';
  END;
  
  IF v_default_due IS NULL THEN
    v_default_due := NOW() + INTERVAL '7 days';
  END IF;

  -- 4. Fix existing NULL rows
  IF v_curriculum_id IS NOT NULL THEN
    UPDATE public.faculty_program_assignments
    SET curriculum_id = v_curriculum_id
    WHERE curriculum_id IS NULL;
  END IF;

  IF v_admin_id IS NOT NULL THEN
    UPDATE public.submission_window_terms
    SET created_by = v_admin_id
    WHERE created_by IS NULL;
  END IF;



  UPDATE public.submissions
  SET due_at = v_default_due
  WHERE due_at IS NULL;
END $$;

-- 5. Install Prevention Triggers for Future Inserts

-- Faculty assignments: auto-populate curriculum_id
CREATE OR REPLACE FUNCTION trg_faculty_program_assignments_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.curriculum_id IS NULL THEN
    SELECT id INTO NEW.curriculum_id 
    FROM public.curricula 
    WHERE program_id = NEW.program_id 
    ORDER BY is_active DESC, created_at ASC 
    LIMIT 1;

    IF NEW.curriculum_id IS NULL THEN
      SELECT id INTO NEW.curriculum_id 
      FROM public.curricula 
      ORDER BY is_active DESC, created_at ASC 
      LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_faculty_program_assignments_defaults ON public.faculty_program_assignments;
CREATE TRIGGER set_faculty_program_assignments_defaults
  BEFORE INSERT ON public.faculty_program_assignments
  FOR EACH ROW
  EXECUTE FUNCTION trg_faculty_program_assignments_defaults();

-- Submissions: auto-populate due_at
CREATE OR REPLACE FUNCTION trg_submissions_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.due_at IS NULL THEN
    BEGIN
      SELECT (end_date::text || ' ' || COALESCE(end_time::text, '23:59:59'))::timestamptz 
      INTO NEW.due_at 
      FROM public.submission_windows 
      ORDER BY created_at DESC 
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NEW.due_at := NULL;
    END;

    IF NEW.due_at IS NULL THEN
      NEW.due_at := NOW() + INTERVAL '7 days';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_submissions_defaults ON public.submissions;
CREATE TRIGGER set_submissions_defaults
  BEFORE INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION trg_submissions_defaults();

-- Submission window terms: auto-populate created_by
CREATE OR REPLACE FUNCTION trg_submission_window_terms_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    SELECT COALESCE(
      (SELECT a.profile_id FROM public.admins a LIMIT 1),
      (SELECT ur.profile_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code ILIKE '%admin%' OR r.code ILIKE '%head%' LIMIT 1),
      (SELECT p.id FROM public.profiles p LIMIT 1)
    ) INTO NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_submission_window_terms_defaults ON public.submission_window_terms;
CREATE TRIGGER set_submission_window_terms_defaults
  BEFORE INSERT ON public.submission_window_terms
  FOR EACH ROW
  EXECUTE FUNCTION trg_submission_window_terms_defaults();

-- Drop legacy description defaults trigger if present
DROP TRIGGER IF EXISTS set_requirement_templates_defaults ON public.requirement_templates;
DROP FUNCTION IF EXISTS public.trg_requirement_templates_defaults();

