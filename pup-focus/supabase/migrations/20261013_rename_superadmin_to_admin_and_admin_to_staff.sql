-- ==============================================================================
-- Migration: Rename Roles (super_admin -> admin, admin -> staff)
-- Date: 2026-10-13
-- Description:
-- 1. Updates roles table codes and display names:
--    'admin' -> 'staff' ('Staff')
--    'super_admin' -> 'admin' ('Admin')
-- 2. Updates user_metadata and app_metadata in auth.users
-- 3. Updates helper functions and policies to grant staff and admin appropriate access
-- 4. Renames table 'admins' to 'staff' (with a backward-compatible view)
-- ==============================================================================

-- 1. Update public.roles table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles') THEN
    -- Temporarily rename 'admin' to 'staff'
    UPDATE public.roles
    SET code = 'staff', name = 'Staff'
    WHERE code = 'admin';

    -- Rename 'super_admin' to 'admin'
    UPDATE public.roles
    SET code = 'admin', name = 'Admin'
    WHERE code = 'super_admin';

    -- Ensure 'staff' and 'admin' exist
    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'staff') THEN
      INSERT INTO public.roles (code, name) VALUES ('staff', 'Staff');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.roles WHERE code = 'admin') THEN
      INSERT INTO public.roles (code, name) VALUES ('admin', 'Admin');
    END IF;
  END IF;
END $$;

-- 2. Update metadata in auth.users
DO $$
BEGIN
  -- First update former 'admin' to 'staff'
  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"staff"'::jsonb
    ),
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"staff"'::jsonb
    )
  WHERE (raw_user_meta_data->>'role' = 'admin' OR raw_app_meta_data->>'role' = 'admin');

  -- Next update former 'super_admin' to 'admin'
  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'::jsonb
    ),
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'::jsonb
    )
  WHERE (raw_user_meta_data->>'role' = 'super_admin' OR raw_app_meta_data->>'role' = 'super_admin');

  -- Ensure primary administrator account has role 'admin' and updated full_name
  UPDATE auth.users
  SET
    raw_user_meta_data = jsonb_set(
      jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        '"admin"'::jsonb
      ),
      '{full_name}',
      '"PUP FOCUS Admin"'::jsonb
    ),
    raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'::jsonb
    )
  WHERE email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com');

  UPDATE public.profiles
  SET full_name = 'PUP FOCUS Admin'
  WHERE email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com');

  UPDATE public.user_roles ur
  SET role_id = r.id
  FROM public.roles r, public.profiles p
  WHERE r.code = 'admin'
    AND p.id = ur.profile_id
    AND p.email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com');
END $$;

-- 3. Rename public.admins to public.staff (if exists) and provide backward-compatible view
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admins'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'staff'
  ) THEN
    ALTER TABLE public.admins RENAME TO staff;
    CREATE OR REPLACE VIEW public.admins AS SELECT * FROM public.staff;
  END IF;
END $$;

-- 4. Update helper security definer functions
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'staff', 'super_admin'),
    false
  ) OR COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'staff', 'super_admin'),
    false
  ) OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.profile_id = p.id
    JOIN public.roles r ON r.id = ur.role_id
    WHERE p.user_id = auth.uid()
      AND r.code IN ('admin', 'staff', 'super_admin')
  );
$$;

GRANT EXECUTE ON FUNCTION app_private.is_admin_or_super_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION app_private.is_admin_or_super_admin() FROM PUBLIC, anon;

-- Wrapper functions
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

CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT app_private.is_admin_or_super_admin();
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_staff() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_staff() FROM PUBLIC, anon;
