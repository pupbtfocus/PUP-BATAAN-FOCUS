-- Core Row Level Security Policies for PUP FOCUS

-- Helper function to check admin / super admin status safely
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

-- Enable RLS on core tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculty_program_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_decisions ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = id OR public.is_admin_or_super_admin());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = id OR public.is_admin_or_super_admin())
  WITH CHECK (auth.uid() = user_id OR auth.uid() = id OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can manage profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- USER_ROLES
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- APP_USERS
CREATE POLICY "Users can view their own app_user record"
  ON public.app_users FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid() OR profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY "Users can update their own app_user record"
  ON public.app_users FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid() OR id = auth.uid() OR public.is_admin_or_super_admin())
  WITH CHECK (auth_user_id = auth.uid() OR id = auth.uid() OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can manage app_users"
  ON public.app_users FOR ALL TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- FACULTY_PROGRAM_ASSIGNMENTS
CREATE POLICY "Faculty can view their own program assignments"
  ON public.faculty_program_assignments FOR SELECT TO authenticated
  USING (faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid() OR id = auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can manage faculty program assignments"
  ON public.faculty_program_assignments FOR ALL TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

-- SUBMISSIONS & DOCUMENTS
CREATE POLICY "faculty_manage_own_submissions" ON public.submissions
  FOR ALL TO authenticated
  USING (faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.is_admin_or_super_admin())
  WITH CHECK (faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR public.is_admin_or_super_admin());

CREATE POLICY "faculty_read_own_documents" ON public.document_versions
  FOR SELECT TO authenticated
  USING (submission_id IN (SELECT id FROM public.submissions WHERE faculty_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())) OR public.is_admin_or_super_admin());

-- AUDIT LOGS & NOTIFICATIONS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.is_admin_or_super_admin() OR actor_id = auth.uid());

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super_admin());

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin_or_super_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin_or_super_admin());

CREATE POLICY "Admins can manage notifications" ON public.notifications
  FOR ALL TO authenticated
  USING (public.is_admin_or_super_admin())
  WITH CHECK (public.is_admin_or_super_admin());

