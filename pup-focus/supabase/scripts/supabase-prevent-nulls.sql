DO $$
DECLARE
  v_admin_id UUID;
  v_default_due TIMESTAMPTZ;
BEGIN
  -- 1. Resolve Admin Profile ID safely
  SELECT COALESCE(
    (SELECT a.profile_id FROM public.admins a LIMIT 1),
    (SELECT ur.profile_id FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id WHERE r.code ILIKE '%admin%' OR r.code ILIKE '%head%' LIMIT 1),
    (SELECT p.id FROM public.profiles p LIMIT 1)
  ) INTO v_admin_id;

  -- 2. Resolve Due Date safely using end_date from submission_windows
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

  -- 3. Fix existing NULL rows
  IF v_admin_id IS NOT NULL THEN
    UPDATE public.submission_window_terms
    SET created_by = v_admin_id
    WHERE created_by IS NULL;
  END IF;

  UPDATE public.submissions
  SET due_at = v_default_due
  WHERE due_at IS NULL;
END $$;

-- 4. Clean up all legacy curriculum triggers and columns
DROP TRIGGER IF EXISTS set_faculty_program_assignments_defaults ON public.faculty_program_assignments;
DROP FUNCTION IF EXISTS public.trg_faculty_program_assignments_defaults();

ALTER TABLE IF EXISTS public.submissions DROP COLUMN IF EXISTS curriculum_id CASCADE;
ALTER TABLE IF EXISTS public.faculty_program_assignments DROP COLUMN IF EXISTS curriculum_id CASCADE;

-- 5. Submissions: auto-populate due_at
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

-- 6. Submission window terms: auto-populate created_by
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

-- 7. Drop legacy description defaults trigger if present
DROP TRIGGER IF EXISTS set_requirement_templates_defaults ON public.requirement_templates;
DROP FUNCTION IF EXISTS public.trg_requirement_templates_defaults();

-- 8. Refresh schema cache
NOTIFY pgrst, 'reload schema';
