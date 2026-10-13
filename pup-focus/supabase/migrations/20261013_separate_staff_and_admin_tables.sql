-- ==============================================================================
-- Migration: Separate staff and admins tables
-- Date: 2026-10-13
-- Description:
-- 1. Drops view admins if it was pointing to staff table
-- 2. Creates distinct physical tables for public.admins and public.staff
-- 3. Populates public.admins strictly with admin accounts
-- 4. Populates public.staff strictly with staff accounts
-- 5. Purges admin accounts from staff table and staff accounts from admins table
-- ==============================================================================

-- 1. Drop view if admins was a view
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.views
    WHERE table_schema = 'public' AND table_name = 'admins'
  ) THEN
    DROP VIEW public.admins CASCADE;
  END IF;
END $$;

-- 2. Create public.admins table if it does not exist
CREATE TABLE IF NOT EXISTS public.admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3. Create public.staff table if it does not exist
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text,
  email text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Enable RLS & policies
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'admins' AND policyname = 'admins_all') THEN
    CREATE POLICY admins_all ON public.admins FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'staff' AND policyname = 'staff_all') THEN
    CREATE POLICY staff_all ON public.staff FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT ALL ON public.admins TO authenticated, service_role;
GRANT ALL ON public.staff TO authenticated, service_role;

-- 5. Populate public.admins ONLY with Admin accounts
INSERT INTO public.admins (profile_id, full_name, email, is_active, updated_at)
SELECT
  p.id,
  CASE
    WHEN p.email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com') THEN 'PUP FOCUS Admin'
    ELSE p.full_name
  END,
  p.email,
  true,
  now()
FROM public.profiles p
JOIN public.user_roles ur ON ur.profile_id = p.id
JOIN public.roles r ON r.id = ur.role_id
WHERE r.code IN ('admin', 'super_admin')
   OR p.email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com')
ON CONFLICT (profile_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

-- 6. Populate public.staff ONLY with Staff accounts
INSERT INTO public.staff (profile_id, full_name, email, is_active, updated_at)
SELECT
  p.id,
  p.full_name,
  p.email,
  true,
  now()
FROM public.profiles p
JOIN public.user_roles ur ON ur.profile_id = p.id
JOIN public.roles r ON r.id = ur.role_id
WHERE r.code = 'staff'
  AND p.email NOT IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com')
ON CONFLICT (profile_id) DO UPDATE
SET full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    updated_at = now();

-- 7. ISOLATION: Purge admin accounts from staff table
DELETE FROM public.staff
WHERE email IN (
  SELECT email FROM public.admins
) OR email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com');

-- Purge staff accounts from admins table
DELETE FROM public.admins
WHERE email NOT IN (
  SELECT p.email
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.profile_id = p.id
  JOIN public.roles r ON r.id = ur.role_id
  WHERE r.code IN ('admin', 'super_admin')
     OR p.email IN ('pupbataanfocus.superadmin@gmail.com', 'pupbataanfocus.admin@gmail.com')
);

-- 8. Fix primary Admin user_metadata, profiles, and user_roles
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
