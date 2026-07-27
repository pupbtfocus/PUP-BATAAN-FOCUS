-- Migration: Enable RLS and Configure Access Control Policies for User Management Tables
-- Purpose: Enable Row Level Security (RLS) on profiles, user_roles, app_users, faculty_program_assignments, admins, and admin_assignments.

-- 1. Helper function to check if the requesting user is an Admin or Super Admin without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super_admin'),
    FALSE
  )
  OR EXISTS (
    SELECT 1 FROM public.app_users
    WHERE (auth_user_id = auth.uid() OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
      AND role IN ('admin', 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = auth.uid()
      AND r.code IN ('admin', 'super_admin')
  );
$$;

-- 2. Enable RLS on core user management tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_program_assignments ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_assignments ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to ensure idempotent migration
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "faculty_read_own_profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;

DROP POLICY IF EXISTS "Users can view their own app_user record" ON public.app_users;
DROP POLICY IF EXISTS "Users can update their own app_user record" ON public.app_users;
DROP POLICY IF EXISTS "Admins can manage app_users" ON public.app_users;

DROP POLICY IF EXISTS "Faculty can view their own program assignments" ON public.faculty_program_assignments;
DROP POLICY IF EXISTS "Admins can manage faculty program assignments" ON public.faculty_program_assignments;

DROP POLICY IF EXISTS "Admins can view admins table" ON public.admins;
DROP POLICY IF EXISTS "Admins can manage admins table" ON public.admins;

DROP POLICY IF EXISTS "Admins can view admin assignments" ON public.admin_assignments;
DROP POLICY IF EXISTS "Admins can manage admin assignments" ON public.admin_assignments;

-- 4. Create RLS Policies for authenticated users

-- PROFILES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = id 
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = id 
    OR public.is_admin_or_super_admin()
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR auth.uid() = id 
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Admins can manage profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- USER_ROLES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid()
    ) 
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- APP_USERS
CREATE POLICY "Users can view their own app_user record"
  ON public.app_users FOR SELECT
  TO authenticated
  USING (
    auth_user_id = auth.uid() 
    OR id = auth.uid() 
    OR profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid()
    ) 
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Users can update their own app_user record"
  ON public.app_users FOR UPDATE
  TO authenticated
  USING (
    auth_user_id = auth.uid() 
    OR id = auth.uid() 
    OR public.is_admin_or_super_admin()
  )
  WITH CHECK (
    auth_user_id = auth.uid() 
    OR id = auth.uid() 
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Admins can manage app_users"
  ON public.app_users FOR ALL
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- FACULTY_PROGRAM_ASSIGNMENTS
CREATE POLICY "Faculty can view their own program assignments"
  ON public.faculty_program_assignments FOR SELECT
  TO authenticated
  USING (
    faculty_profile_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid()
    ) 
    OR public.is_admin_or_super_admin()
  );

CREATE POLICY "Admins can manage faculty program assignments"
  ON public.faculty_program_assignments FOR ALL
  TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- ADMINS
DO $$
BEGIN
  IF to_regclass('public.admins') IS NOT NULL THEN
    EXECUTE '
      CREATE POLICY "Admins can view admins table"
        ON public.admins FOR SELECT
        TO authenticated
        USING (
          profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid())
          OR public.is_admin_or_super_admin()
        );
      CREATE POLICY "Admins can manage admins table"
        ON public.admins FOR ALL
        TO authenticated
        USING (public.is_admin_or_super_admin())
        WITH CHECK (public.is_admin_or_super_admin());
    ';
  END IF;
END $$;

-- ADMIN_ASSIGNMENTS
DO $$
BEGIN
  IF to_regclass('public.admin_assignments') IS NOT NULL THEN
    EXECUTE '
      CREATE POLICY "Admins can view admin assignments"
        ON public.admin_assignments FOR SELECT
        TO authenticated
        USING (
          admin_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid())
          OR public.is_admin_or_super_admin()
        );
      CREATE POLICY "Admins can manage admin assignments"
        ON public.admin_assignments FOR ALL
        TO authenticated
        USING (public.is_admin_or_super_admin())
        WITH CHECK (public.is_admin_or_super_admin());
    ';
  END IF;
END $$;
