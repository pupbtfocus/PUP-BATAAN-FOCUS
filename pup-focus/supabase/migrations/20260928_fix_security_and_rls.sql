-- Fix mutable search path for security functions
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin_or_super_admin() SET search_path = public, pg_temp;

-- Revoke execute permissions on security functions from public/anon/authenticated API callers
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_or_super_admin() FROM PUBLIC, anon;

-- Fix overly permissive RLS policies (USING/WITH CHECK = true)
DROP POLICY IF EXISTS "Admins and Super Admins can manage backups" ON public.system_backups;
CREATE POLICY "Admins and Super Admins can manage backups"
ON public.system_backups FOR ALL TO authenticated
USING (public.is_admin_or_super_admin())
WITH CHECK (public.is_admin_or_super_admin());

DROP POLICY IF EXISTS "Allow authenticated users to insert or update submission window" ON public.submission_window_terms;
CREATE POLICY "Allow admins to insert or update submission window"
ON public.submission_window_terms FOR ALL TO authenticated
USING (public.is_admin_or_super_admin())
WITH CHECK (public.is_admin_or_super_admin());

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
CREATE POLICY "Authenticated users can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
