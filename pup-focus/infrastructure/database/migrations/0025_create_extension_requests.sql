-- Migration: 0025_create_extension_requests.sql
-- Description: Creates extension_requests table to track faculty requests for submission window deadline extensions.

CREATE TABLE IF NOT EXISTS public.extension_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  faculty_name text NOT NULL,
  faculty_email text,
  department text,
  academic_year text NOT NULL,
  semester text NOT NULL,
  requirement_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  reason text NOT NULL,
  requested_preset text NOT NULL DEFAULT '+3 Days',
  requested_date date,
  requested_time text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_remarks text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_extension_requests_faculty_user_id
  ON public.extension_requests(faculty_user_id);

CREATE INDEX IF NOT EXISTS idx_extension_requests_status
  ON public.extension_requests(status);

CREATE INDEX IF NOT EXISTS idx_extension_requests_term
  ON public.extension_requests(academic_year, semester);

CREATE INDEX IF NOT EXISTS idx_extension_requests_created_at
  ON public.extension_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.extension_requests ENABLE ROW LEVEL SECURITY;

-- Faculty can read their own extension requests
DROP POLICY IF EXISTS "Faculty can view own extension requests" ON public.extension_requests;
CREATE POLICY "Faculty can view own extension requests"
  ON public.extension_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = faculty_user_id);

-- Faculty can insert their own extension requests
DROP POLICY IF EXISTS "Faculty can submit extension requests" ON public.extension_requests;
CREATE POLICY "Faculty can submit extension requests"
  ON public.extension_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = faculty_user_id);

-- Admins and Super Admins can view all extension requests
DROP POLICY IF EXISTS "Admins can view all extension requests" ON public.extension_requests;
CREATE POLICY "Admins can view all extension requests"
  ON public.extension_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin_or_super_admin()
  );

-- Admins and Super Admins can update extension requests (approve/reject)
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
