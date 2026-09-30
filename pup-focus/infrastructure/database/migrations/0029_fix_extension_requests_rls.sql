-- Migration: 0029_fix_extension_requests_rls.sql
-- Description: Fix Supabase database linter error (0015_rls_references_user_metadata)
-- by replacing user_metadata reference in extension_requests RLS policies with public.is_admin_or_super_admin().

DROP POLICY IF EXISTS "Admins can view all extension requests" ON public.extension_requests;
CREATE POLICY "Admins can view all extension requests"
  ON public.extension_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_super_admin()
  );

DROP POLICY IF EXISTS "Admins can update extension requests" ON public.extension_requests;
CREATE POLICY "Admins can update extension requests"
  ON public.extension_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin_or_super_admin()
  )
  WITH CHECK (
    public.is_admin_or_super_admin()
  );
