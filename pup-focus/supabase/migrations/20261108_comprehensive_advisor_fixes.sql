-- ==============================================================================
-- Migration: Comprehensive Supabase Advisor Fixes (Safe / Idempotent)
-- Date: 2026-11-08
-- Description:
-- 1. Safely checks column existence before adding FK indexes
-- 2. Drops duplicate indexes safely
-- 3. Optimizes Auth RLS with (select auth.uid()) InitPlan caching
-- 4. Cleans up existing policy names before re-creating
-- ==============================================================================

-- ==============================================================================
-- PART 1: ADD MISSING INDEXES ON FOREIGN KEYS SAFELY
-- ==============================================================================
DO $$
BEGIN
  -- extension_requests
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='extension_requests' AND column_name='faculty_user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_ext_requests_user ON public.extension_requests(faculty_user_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='extension_requests' AND column_name='reviewed_by') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_ext_requests_reviewed_by ON public.extension_requests(reviewed_by);
  END IF;

  -- faculty_classes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faculty_classes' AND column_name='faculty_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_faculty_classes_profile ON public.faculty_classes(faculty_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faculty_classes' AND column_name='academic_term_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_faculty_classes_term ON public.faculty_classes(academic_term_id);
  END IF;

  -- faculty_program_assignments
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faculty_program_assignments' AND column_name='faculty_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_faculty_prog_assign_profile ON public.faculty_program_assignments(faculty_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='faculty_program_assignments' AND column_name='program_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_faculty_prog_assign_program ON public.faculty_program_assignments(program_id);
  END IF;

  -- submission_window_terms
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submission_window_terms' AND column_name='submission_window_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_sub_window_terms_window ON public.submission_window_terms(submission_window_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submission_window_terms' AND column_name='academic_term_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_sub_window_terms_term ON public.submission_window_terms(academic_term_id);
  END IF;

  -- submission_windows
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submission_windows' AND column_name='created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_sub_windows_created_by ON public.submission_windows(created_by);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submission_windows' AND column_name='academic_term_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_sub_windows_term ON public.submission_windows(academic_term_id);
  END IF;

  -- submissions
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submissions' AND column_name='class_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_submissions_class ON public.submissions(class_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submissions' AND column_name='faculty_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_submissions_faculty_profile ON public.submissions(faculty_profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submissions' AND column_name='faculty_assignment_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_submissions_assignment ON public.submissions(faculty_assignment_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='submissions' AND column_name='user_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_submissions_user_id ON public.submissions(user_id);
  END IF;

  -- system_backups
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_backups' AND column_name='created_by') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_system_backups_created_by ON public.system_backups(created_by);
  END IF;

  -- user_roles
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name='profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_user_roles_profile ON public.user_roles(profile_id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_roles' AND column_name='role_id') THEN
    CREATE INDEX IF NOT EXISTS idx_fk_user_roles_role ON public.user_roles(role_id);
  END IF;
END $$;

-- ==============================================================================
-- PART 2: DROP DUPLICATE INDEXES SAFELY
-- ==============================================================================
DO $$
DECLARE
  dup_record RECORD;
BEGIN
  FOR dup_record IN
    SELECT 
      indrelid::regclass AS table_name,
      indexrelid::regclass AS index_to_drop
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND indrelid::regclass::text IN ('public.staff', 'public.submissions', 'public.faculty_classes')
      AND NOT indisprimary
      AND EXISTS (
        SELECT 1 FROM pg_index i2
        WHERE i2.indrelid = i.indrelid
          AND i2.indexrelid != i.indexrelid
          AND i2.indkey = i.indkey
          AND i2.indclass = i.indclass
          AND (i2.indpred IS NULL AND i.indpred IS NULL OR i2.indpred = i.indpred)
          AND i2.indexrelid < i.indexrelid
      )
  LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || dup_record.index_to_drop;
  END LOOP;
END $$;

-- ==============================================================================
-- PART 3: OPTIMIZE RLS (InitPlan caching + Consolidate Overlapping Policies)
-- ==============================================================================
CREATE OR REPLACE FUNCTION app_private.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'),
    FALSE
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = (SELECT auth.uid())
      AND r.code IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') IN ('staff', 'admin', 'super_admin'),
    FALSE
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = (SELECT auth.uid())
      AND r.code IN ('staff', 'admin', 'super_admin')
  );
$$;

-- PROFILES
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR id = (SELECT auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()) OR id = (SELECT auth.uid()) OR public.is_admin_or_super_admin())
  WITH CHECK (user_id = (SELECT auth.uid()) OR id = (SELECT auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY profiles_delete ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin_or_super_admin());

-- ADMINS
DROP POLICY IF EXISTS admins_all ON public.admins;
DROP POLICY IF EXISTS admins_modify ON public.admins;
DROP POLICY IF EXISTS admins_select ON public.admins;
DROP POLICY IF EXISTS admins_insert ON public.admins;
DROP POLICY IF EXISTS admins_update ON public.admins;
DROP POLICY IF EXISTS admins_delete ON public.admins;

CREATE POLICY admins_select ON public.admins FOR SELECT TO authenticated USING (true);
CREATE POLICY admins_insert ON public.admins FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY admins_update ON public.admins FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin()) WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY admins_delete ON public.admins FOR DELETE TO authenticated USING (public.is_admin_or_super_admin());

-- STAFF
DROP POLICY IF EXISTS staff_all ON public.staff;
DROP POLICY IF EXISTS staff_modify ON public.staff;
DROP POLICY IF EXISTS staff_select ON public.staff;
DROP POLICY IF EXISTS staff_insert ON public.staff;
DROP POLICY IF EXISTS staff_update ON public.staff;
DROP POLICY IF EXISTS staff_delete ON public.staff;

CREATE POLICY staff_select ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY staff_insert ON public.staff FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY staff_update ON public.staff FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin()) WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY staff_delete ON public.staff FOR DELETE TO authenticated USING (public.is_admin_or_super_admin());

-- FACULTY_CLASSES
DROP POLICY IF EXISTS faculty_classes_all ON public.faculty_classes;
DROP POLICY IF EXISTS faculty_classes_modify ON public.faculty_classes;
DROP POLICY IF EXISTS faculty_classes_select ON public.faculty_classes;
DROP POLICY IF EXISTS faculty_classes_insert ON public.faculty_classes;
DROP POLICY IF EXISTS faculty_classes_update ON public.faculty_classes;
DROP POLICY IF EXISTS faculty_classes_delete ON public.faculty_classes;

CREATE POLICY faculty_classes_select ON public.faculty_classes FOR SELECT TO authenticated USING (true);
CREATE POLICY faculty_classes_insert ON public.faculty_classes FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY faculty_classes_update ON public.faculty_classes FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY faculty_classes_delete ON public.faculty_classes FOR DELETE TO authenticated USING (public.is_staff_or_admin());

-- USER_ROLES
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;

CREATE POLICY user_roles_select ON public.user_roles FOR SELECT TO authenticated
  USING (profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid())) OR public.is_admin_or_super_admin());
CREATE POLICY user_roles_insert ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY user_roles_update ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin_or_super_admin()) WITH CHECK (public.is_admin_or_super_admin());
CREATE POLICY user_roles_delete ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin_or_super_admin());

-- EXTENSION_REQUESTS
DROP POLICY IF EXISTS "Admins can view all extension requests" ON public.extension_requests;
DROP POLICY IF EXISTS "Admins can update extension requests" ON public.extension_requests;
DROP POLICY IF EXISTS ext_requests_all ON public.extension_requests;
DROP POLICY IF EXISTS ext_requests_select ON public.extension_requests;
DROP POLICY IF EXISTS ext_requests_insert ON public.extension_requests;
DROP POLICY IF EXISTS ext_requests_update ON public.extension_requests;

CREATE POLICY ext_requests_select ON public.extension_requests
  FOR SELECT TO authenticated
  USING (
    faculty_user_id = (SELECT auth.uid())
    OR public.is_staff_or_admin()
  );

CREATE POLICY ext_requests_insert ON public.extension_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    faculty_user_id = (SELECT auth.uid())
    OR public.is_staff_or_admin()
  );

CREATE POLICY ext_requests_update ON public.extension_requests
  FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- SUBMISSIONS
DROP POLICY IF EXISTS "faculty_manage_own_submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Users read own submissions and staff/admins read all" ON public.submissions;
DROP POLICY IF EXISTS "Users update own pending submissions and staff/admins update all" ON public.submissions;
DROP POLICY IF EXISTS "Only admins can delete submissions" ON public.submissions;
DROP POLICY IF EXISTS submissions_select ON public.submissions;
DROP POLICY IF EXISTS submissions_insert ON public.submissions;
DROP POLICY IF EXISTS submissions_update ON public.submissions;
DROP POLICY IF EXISTS submissions_delete ON public.submissions;

CREATE POLICY submissions_select ON public.submissions FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR faculty_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR public.is_staff_or_admin()
  );

CREATE POLICY submissions_insert ON public.submissions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR faculty_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    OR public.is_staff_or_admin()
  );

CREATE POLICY submissions_update ON public.submissions FOR UPDATE TO authenticated
  USING (
    ((user_id = (SELECT auth.uid()) OR faculty_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))) AND status = 'pending')
    OR public.is_staff_or_admin()
  )
  WITH CHECK (
    ((user_id = (SELECT auth.uid()) OR faculty_profile_id IN (SELECT p.id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))) AND status = 'pending')
    OR public.is_staff_or_admin()
  );

CREATE POLICY submissions_delete ON public.submissions FOR DELETE TO authenticated
  USING (public.is_admin_or_super_admin());

-- NOTIFICATIONS
DROP POLICY IF EXISTS notifications_all ON public.notifications;
DROP POLICY IF EXISTS notifications_select ON public.notifications;
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_update ON public.notifications;

CREATE POLICY notifications_select ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY notifications_update ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_super_admin()
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.is_admin_or_super_admin()
  );

-- TRANSACTION_LOGS
DROP POLICY IF EXISTS transaction_logs_all ON public.transaction_logs;
DROP POLICY IF EXISTS transaction_logs_select ON public.transaction_logs;
DROP POLICY IF EXISTS transaction_logs_insert ON public.transaction_logs;

CREATE POLICY transaction_logs_select ON public.transaction_logs FOR SELECT TO authenticated USING (public.is_admin_or_super_admin());
CREATE POLICY transaction_logs_insert ON public.transaction_logs FOR INSERT TO authenticated WITH CHECK (true);
