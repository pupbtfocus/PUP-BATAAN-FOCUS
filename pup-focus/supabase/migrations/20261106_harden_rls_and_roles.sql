-- ==============================================================================
-- Migration: Harden RLS Role Checks & Lock Down Account/Class Tables
-- Date: 2026-11-06
-- Description:
-- 1. Backfills auth.users.raw_app_meta_data.role from public.user_roles
-- 2. Removes client-writable user_metadata.role from app_private.is_admin_or_super_admin()
-- 3. Adds app_private.is_staff_or_admin() and public.is_staff_or_admin()
-- 4. Replaces overly permissive RLS policies on admins, staff, and faculty_classes
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 1. Backfill raw_app_meta_data.role from authoritative public.user_roles
UPDATE auth.users u
SET raw_app_meta_data = jsonb_set(
  COALESCE(u.raw_app_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(r.code)
)
FROM public.profiles p
JOIN public.user_roles ur ON ur.profile_id = p.id
JOIN public.roles r ON r.id = ur.role_id
WHERE p.user_id = u.id
  AND (u.raw_app_meta_data ->> 'role') IS DISTINCT FROM r.code;

-- 2. Harden admin role check (never trust user_metadata)
CREATE OR REPLACE FUNCTION app_private.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin'),
    FALSE
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = auth.uid()
      AND r.code IN ('admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.is_admin_or_super_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION app_private.is_admin_or_super_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION app_private.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('staff', 'admin', 'super_admin'),
    FALSE
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = auth.uid()
      AND r.code IN ('staff', 'admin', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.is_staff_or_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION app_private.is_staff_or_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT app_private.is_admin_or_super_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_super_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super_admin() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT app_private.is_staff_or_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_staff_or_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin() FROM PUBLIC, anon;

-- 3. Harden RLS policies on admins, staff, and faculty_classes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admins') THEN
    ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS admins_all ON public.admins;
    DROP POLICY IF EXISTS admins_select ON public.admins;
    DROP POLICY IF EXISTS admins_modify ON public.admins;

    CREATE POLICY admins_select ON public.admins
      FOR SELECT TO authenticated
      USING (public.is_staff_or_admin() OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

    CREATE POLICY admins_modify ON public.admins
      FOR ALL TO authenticated
      USING (public.is_admin_or_super_admin())
      WITH CHECK (public.is_admin_or_super_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff') THEN
    ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS staff_all ON public.staff;
    DROP POLICY IF EXISTS staff_select ON public.staff;
    DROP POLICY IF EXISTS staff_modify ON public.staff;

    CREATE POLICY staff_select ON public.staff
      FOR SELECT TO authenticated
      USING (public.is_staff_or_admin() OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

    CREATE POLICY staff_modify ON public.staff
      FOR ALL TO authenticated
      USING (public.is_admin_or_super_admin())
      WITH CHECK (public.is_admin_or_super_admin());
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'faculty_classes') THEN
    ALTER TABLE public.faculty_classes ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS faculty_classes_all ON public.faculty_classes;
    DROP POLICY IF EXISTS faculty_classes_select ON public.faculty_classes;
    DROP POLICY IF EXISTS faculty_classes_modify ON public.faculty_classes;

    CREATE POLICY faculty_classes_select ON public.faculty_classes
      FOR SELECT TO authenticated
      USING (
        public.is_staff_or_admin()
        OR faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      );

    CREATE POLICY faculty_classes_modify ON public.faculty_classes
      FOR ALL TO authenticated
      USING (
        public.is_staff_or_admin()
        OR faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      )
      WITH CHECK (
        public.is_staff_or_admin()
        OR faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
      );
  END IF;
END $$;

