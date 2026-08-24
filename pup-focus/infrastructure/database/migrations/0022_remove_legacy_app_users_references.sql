-- Migration: 0022_remove_legacy_app_users_references.sql
-- Purpose: Remove all legacy references to public.app_users table and ensure RLS helper function
-- checks profiles, user_roles, and admins tables cleanly.

-- 1) Update public.is_admin_or_super_admin() function
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
  OR COALESCE(
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

-- 2) Drop legacy RLS policies on app_users if table exists
DO $$
BEGIN
  IF to_regclass('public.app_users') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Users can view their own app_user record" ON public.app_users;
    DROP POLICY IF EXISTS "Users can update their own app_user record" ON public.app_users;
    DROP POLICY IF EXISTS "Admins can manage app_users" ON public.app_users;
    
    -- Drop cleanup trigger if exists
    DROP TRIGGER IF EXISTS trg_cleanup_app_users_on_profile_delete ON public.profiles;
    DROP FUNCTION IF EXISTS public.cleanup_app_users_on_profile_delete();
    
    -- Drop legacy table
    DROP TABLE IF EXISTS public.app_users CASCADE;
  END IF;
END $$;
