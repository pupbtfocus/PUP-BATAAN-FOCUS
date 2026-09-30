-- Migration: 20260930_revoke_rls_auto_enable.sql
-- Description: Revoke public/anon/authenticated execution on public.rls_auto_enable()
-- Resolves Supabase linter warnings:
-- - anon_security_definer_function_executable (0028)
-- - authenticated_security_definer_function_executable (0029)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'rls_auto_enable'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO postgres, service_role;';
  END IF;
END $$;
