-- ==============================================================================
-- Migration: Fix Submissions & Storage RLS Policies (Security Advisor)
-- Date: 2026-11-08
-- Description:
-- Replaces insecure client-writable user_metadata checks with secure
-- public.is_staff_or_admin() and public.is_admin_or_super_admin() helper functions.
-- ==============================================================================

-- 1. Fix public.submissions policies
DROP POLICY IF EXISTS "Users read own submissions and staff/admins read all" ON public.submissions;
CREATE POLICY "Users read own submissions and staff/admins read all"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_staff_or_admin()
);

DROP POLICY IF EXISTS "Users update own pending submissions and staff/admins update all" ON public.submissions;
CREATE POLICY "Users update own pending submissions and staff/admins update all"
ON public.submissions
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND status = 'pending')
  OR public.is_staff_or_admin()
)
WITH CHECK (
  (auth.uid() = user_id AND status = 'pending')
  OR public.is_staff_or_admin()
);

DROP POLICY IF EXISTS "Only admins can delete submissions" ON public.submissions;
CREATE POLICY "Only admins can delete submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_super_admin()
);

-- 2. Fix storage.objects policies ('requirements' bucket)
DROP POLICY IF EXISTS "Users view own requirement files and staff/admins view all" ON storage.objects;
CREATE POLICY "Users view own requirement files and staff/admins view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'requirements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_staff_or_admin()
  )
);

DROP POLICY IF EXISTS "Users delete own requirement files and admins delete all" ON storage.objects;
CREATE POLICY "Users delete own requirement files and admins delete all"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'requirements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin_or_super_admin()
  )
);

