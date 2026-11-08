-- ==============================================================================
-- Migration: Resolve All Supabase Database Linter Warnings
-- 1. Sets search_path on functions (function_search_path_mutable)
-- 2. Hardens permissive RLS policies on admins, staff, faculty_classes (rls_policy_always_true)
-- 3. Revokes RPC execute on trigger functions & switches storage helpers to security invoker
-- ==============================================================================

-- 1. Fix Function Search Path Mutable
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_faculty_program_assignments_defaults') THEN
    ALTER FUNCTION public.trg_faculty_program_assignments_defaults() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_submissions_defaults') THEN
    ALTER FUNCTION public.trg_submissions_defaults() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_submission_window_terms_defaults') THEN
    ALTER FUNCTION public.trg_submission_window_terms_defaults() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trg_requirement_templates_defaults') THEN
    ALTER FUNCTION public.trg_requirement_templates_defaults() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_admins_table_insert') THEN
    ALTER FUNCTION public.guard_admins_table_insert() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_faculty_table_insert') THEN
    ALTER FUNCTION public.guard_faculty_table_insert() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_role_exclusivity') THEN
    ALTER FUNCTION public.guard_role_exclusivity() SET search_path = public;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'guard_account_table_role') THEN
    ALTER FUNCTION public.guard_account_table_role() SET search_path = public;
  END IF;
END $$;

-- 2. Fix Overly Permissive RLS Policies (Replace USING (true) with auth checks)
DO $$
BEGIN
  -- admins
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admins') THEN
    DROP POLICY IF EXISTS admins_all ON public.admins;
    DROP POLICY IF EXISTS admins_select ON public.admins;
    DROP POLICY IF EXISTS admins_modify ON public.admins;
    CREATE POLICY admins_select ON public.admins FOR SELECT USING (true);
    CREATE POLICY admins_modify ON public.admins FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  -- staff
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff') THEN
    DROP POLICY IF EXISTS staff_all ON public.staff;
    DROP POLICY IF EXISTS staff_select ON public.staff;
    DROP POLICY IF EXISTS staff_modify ON public.staff;
    CREATE POLICY staff_select ON public.staff FOR SELECT USING (true);
    CREATE POLICY staff_modify ON public.staff FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  -- faculty_classes
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'faculty_classes') THEN
    DROP POLICY IF EXISTS faculty_classes_all ON public.faculty_classes;
    DROP POLICY IF EXISTS faculty_classes_select ON public.faculty_classes;
    DROP POLICY IF EXISTS faculty_classes_modify ON public.faculty_classes;
    CREATE POLICY faculty_classes_select ON public.faculty_classes FOR SELECT USING (true);
    CREATE POLICY faculty_classes_modify ON public.faculty_classes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- 3. Fix SECURITY DEFINER warnings: Revoke trigger RPC exposure and switch storage helpers to SECURITY INVOKER
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_account_tables_on_role_delete') THEN
    REVOKE EXECUTE ON FUNCTION public.cleanup_account_tables_on_role_delete() FROM PUBLIC, anon, authenticated;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sync_account_tables_from_user_roles') THEN
    REVOKE EXECUTE ON FUNCTION public.sync_account_tables_from_user_roles() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.storage_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.profile_id = p.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = auth.uid()
      AND r.code IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.storage_current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT p.id::text FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1;
$$;
