-- 1. Create a private schema that is not exposed to PostgREST
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 2. Define internal SECURITY DEFINER function inside app_private schema
CREATE OR REPLACE FUNCTION app_private.is_admin_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

GRANT EXECUTE ON FUNCTION app_private.is_admin_or_super_admin() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION app_private.is_admin_or_super_admin() FROM PUBLIC, anon;

-- 3. Replace public.is_admin_or_super_admin() with a SECURITY INVOKER wrapper.
-- This clears the "authenticated_security_definer_function_executable" lint finding
-- while maintaining full compatibility with all existing RLS policies.
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
