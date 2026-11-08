-- ============================================================================
-- 0. Add user_id column to link with Supabase Auth
-- ============================================================================
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 1. Enable Row Level Security (RLS) on public.submissions
-- ============================================================================
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. RLS Policies for public.submissions
-- ============================================================================

-- INSERT: Authenticated users can insert only if auth.uid() = user_id
CREATE POLICY "Users can insert own submissions"
ON public.submissions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- SELECT: Users read their own submissions; admin, staff, and super-admin read all
CREATE POLICY "Users read own submissions and staff/admins read all"
ON public.submissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'staff', 'super-admin')
);

-- UPDATE: Users can update their own ONLY if status is 'pending'; Admins and Staff update all
CREATE POLICY "Users update own pending submissions and staff/admins update all"
ON public.submissions
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = user_id AND status = 'pending')
  OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'staff', 'super-admin')
)
WITH CHECK (
  (auth.uid() = user_id AND status = 'pending')
  OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'staff', 'super-admin')
);

-- DELETE: Only 'admin' and 'super-admin' can delete
CREATE POLICY "Only admins can delete submissions"
ON public.submissions
FOR DELETE
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super-admin')
);

-- ============================================================================
-- 3. Storage Policies for storage.objects ('requirements' bucket)
-- ============================================================================

-- SELECT: Users view files in their auth.uid() folder; Admins/Staff view all
CREATE POLICY "Users view own requirement files and staff/admins view all"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'requirements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'staff', 'super-admin')
  )
);

-- INSERT: Bucket is 'requirements', folder matches auth.uid(), allowed extensions, and size <= 5MB
CREATE POLICY "Users upload valid requirement files to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'requirements'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND lower(storage.extension(name)) IN ('pdf', 'jpg', 'jpeg', 'png')
  AND ((metadata ->> 'size')::bigint <= 5242880)
);

-- DELETE: Users delete their own files; Admins delete all
CREATE POLICY "Users delete own requirement files and admins delete all"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'requirements'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'super-admin')
  )
);

