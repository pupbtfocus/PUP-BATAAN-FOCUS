-- ====================================================================
-- Migration: 0031_strict_faculty_admin_separation.sql
-- Description:
--   1. Ensures public.faculty and public.admins tables have unique constraints.
--   2. Cleans up existing data conflicts immediately:
--      - Removes faculty profiles from public.admins and ensures they are in public.faculty.
--      - Removes admin profiles from public.faculty and ensures they are in public.admins.
--   3. Installs database triggers to strictly enforce role & table exclusivity:
--      - Granting 'faculty' role automatically removes 'admin'/'super_admin' roles,
--        deletes from public.admins, and upserts into public.faculty.
--      - Granting 'admin'/'super_admin' role automatically removes 'faculty' role,
--        deletes from public.faculty, and upserts into public.admins.
--      - Prevents any direct inserts of faculty accounts into public.admins and vice versa.
-- Safe to re-run anytime.
-- ====================================================================

-- 1. Ensure public.faculty table exists with proper columns and constraints
CREATE TABLE IF NOT EXISTS public.faculty (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  department text,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.faculty
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Clean up any duplicate faculty rows before adding constraints
DELETE FROM public.faculty f
USING public.faculty d
WHERE f.profile_id = d.profile_id AND f.created_at > d.created_at;

DELETE FROM public.faculty f
USING public.faculty d
WHERE lower(f.email) = lower(d.email) AND f.created_at > d.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS faculty_profile_id_key ON public.faculty(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS faculty_email_key ON public.faculty(lower(email));

-- Ensure public.admins has unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_profile_id_unique ON public.admins(profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_email_unique ON public.admins(lower(email));

-- 2. Immediate Data Cleanup
-- A. Any account whose auth metadata role is 'faculty':
--    Must be in public.faculty, NEVER in public.admins, and ONLY have 'faculty' in user_roles.
DELETE FROM public.admins a
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.id = a.profile_id
    AND (
      lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) = 'faculty'
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.profile_id = p.id AND r.code = 'faculty'
      )
    )
    AND lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) <> 'super_admin'
);

-- Remove admin roles from any profile that has faculty role or metadata
DELETE FROM public.user_roles ur
WHERE ur.role_id IN (SELECT id FROM public.roles WHERE code IN ('admin', 'super_admin'))
  AND ur.profile_id IN (
    SELECT p.id FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) = 'faculty'
  );

-- B. Any account whose auth metadata is admin/super_admin:
--    Must be in public.admins, NEVER in public.faculty.
DELETE FROM public.faculty f
WHERE EXISTS (
  SELECT 1 FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE p.id = f.profile_id
    AND lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) IN ('admin', 'super_admin')
);

DELETE FROM public.user_roles ur
WHERE ur.role_id IN (SELECT id FROM public.roles WHERE code = 'faculty')
  AND ur.profile_id IN (
    SELECT p.id FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) IN ('admin', 'super_admin')
  );

-- C. Backfill public.faculty from all profiles with faculty role or metadata
INSERT INTO public.faculty (profile_id, user_id, full_name, email, is_active, updated_at)
SELECT p.id, p.user_id, p.full_name, p.email, true, now()
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE (
  lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) = 'faculty'
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.profile_id = p.id AND r.code = 'faculty'
  )
)
AND NOT EXISTS (
  SELECT 1 FROM public.roles r
  JOIN public.user_roles ur ON ur.role_id = r.id
  WHERE ur.profile_id = p.id AND r.code IN ('super_admin')
)
ON CONFLICT (profile_id) DO UPDATE
  SET full_name = excluded.full_name,
      email = excluded.email,
      user_id = excluded.user_id,
      updated_at = now();

-- Ensure all faculty profiles have faculty role in user_roles
INSERT INTO public.user_roles (profile_id, role_id)
SELECT f.profile_id, r.id
FROM public.faculty f
CROSS JOIN public.roles r
WHERE r.code = 'faculty'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.profile_id = f.profile_id AND ur.role_id = r.id
  )
ON CONFLICT DO NOTHING;

-- D. Backfill public.admins from all profiles with admin/super_admin role or metadata
INSERT INTO public.admins (profile_id, full_name, email, is_active, updated_at)
SELECT p.id, p.full_name, p.email, true, now()
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE lower(coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role', '')) IN ('admin', 'super_admin')
ON CONFLICT (profile_id) DO UPDATE
  SET full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();


-- 3. Robust Trigger Functions to Enforce Mutual Exclusivity

-- A. Synchronize account tables on user_roles change
CREATE OR REPLACE FUNCTION public.sync_account_tables_from_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_profile record;
BEGIN
  SELECT code INTO v_code FROM public.roles WHERE id = NEW.role_id;
  SELECT id, user_id, full_name, email INTO v_profile
  FROM public.profiles WHERE id = NEW.profile_id;

  IF v_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_code = 'faculty' THEN
    -- 1. Purge any admin roles for this profile
    DELETE FROM public.user_roles
    WHERE profile_id = NEW.profile_id
      AND role_id IN (SELECT id FROM public.roles WHERE code IN ('admin', 'super_admin'));

    -- 2. Remove from admins table
    DELETE FROM public.admins WHERE profile_id = NEW.profile_id;

    -- 3. Insert or update faculty table
    INSERT INTO public.faculty (profile_id, user_id, full_name, email, is_active, updated_at)
    VALUES (v_profile.id, v_profile.user_id, v_profile.full_name, v_profile.email, true, now())
    ON CONFLICT (profile_id) DO UPDATE
      SET full_name = excluded.full_name,
          email = excluded.email,
          user_id = excluded.user_id,
          updated_at = now();

  ELSIF v_code IN ('admin', 'super_admin') THEN
    -- 1. Purge faculty roles for this profile
    DELETE FROM public.user_roles
    WHERE profile_id = NEW.profile_id
      AND role_id IN (SELECT id FROM public.roles WHERE code = 'faculty');

    -- 2. Remove from faculty table
    DELETE FROM public.faculty WHERE profile_id = NEW.profile_id;

    -- 3. Insert or update admins table
    INSERT INTO public.admins (profile_id, full_name, email, is_active, updated_at)
    VALUES (v_profile.id, v_profile.full_name, v_profile.email, true, now())
    ON CONFLICT (profile_id) DO UPDATE
      SET full_name = excluded.full_name,
          email = excluded.email,
          updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_account_tables ON public.user_roles;
CREATE TRIGGER trg_sync_account_tables
AFTER INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_account_tables_from_user_roles();


-- B. Clean up account tables when a role is revoked
CREATE OR REPLACE FUNCTION public.cleanup_account_tables_on_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  SELECT code INTO v_code FROM public.roles WHERE id = OLD.role_id;

  IF v_code = 'faculty' THEN
    DELETE FROM public.faculty WHERE profile_id = OLD.profile_id;
  ELSIF v_code IN ('admin', 'super_admin') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.profile_id = OLD.profile_id
        AND ur.id <> OLD.id
        AND r.code IN ('admin', 'super_admin')
    ) THEN
      DELETE FROM public.admins WHERE profile_id = OLD.profile_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_account_tables ON public.user_roles;
CREATE TRIGGER trg_cleanup_account_tables
AFTER DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.cleanup_account_tables_on_role_delete();


-- C. Hard table guards preventing cross-table pollution
CREATE OR REPLACE FUNCTION public.guard_admins_table_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_faculty boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.profile_id = NEW.profile_id AND r.code = 'faculty'
  ) OR EXISTS (
    SELECT 1 FROM public.faculty WHERE profile_id = NEW.profile_id
  ) INTO v_is_faculty;

  IF v_is_faculty THEN
    RAISE EXCEPTION 'Cannot insert profile % into admins table because it is a faculty account.', NEW.profile_id
      USING errcode = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_admins_table ON public.admins;
DROP TRIGGER IF EXISTS trg_guard_admins_role ON public.admins;
CREATE TRIGGER trg_guard_admins_table
BEFORE INSERT OR UPDATE ON public.admins
FOR EACH ROW EXECUTE FUNCTION public.guard_admins_table_insert();


CREATE OR REPLACE FUNCTION public.guard_faculty_table_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.profile_id = NEW.profile_id AND r.code IN ('admin', 'super_admin')
  ) OR EXISTS (
    SELECT 1 FROM public.admins WHERE profile_id = NEW.profile_id
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RAISE EXCEPTION 'Cannot insert profile % into faculty table because it is an admin account.', NEW.profile_id
      USING errcode = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_faculty_table ON public.faculty;
DROP TRIGGER IF EXISTS trg_guard_faculty_role ON public.faculty;
CREATE TRIGGER trg_guard_faculty_table
BEFORE INSERT OR UPDATE ON public.faculty
FOR EACH ROW EXECUTE FUNCTION public.guard_faculty_table_insert();
