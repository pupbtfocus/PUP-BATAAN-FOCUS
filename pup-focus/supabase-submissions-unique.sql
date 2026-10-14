-- 1) Remove all onboarding placeholder rows (rows without storage path or class)
DELETE FROM public.submissions
WHERE class_id IS NULL
  AND storage_path IS NULL
  AND status = 'pending';

-- 2) Remove any remaining duplicate rows (keeping newest)
WITH duplicates_to_delete AS (
  SELECT a.id
  FROM public.submissions a
  JOIN public.submissions b
    ON a.faculty_profile_id = b.faculty_profile_id
   AND a.requirement_code = b.requirement_code
   AND a.is_archived = false
   AND b.is_archived = false
   AND COALESCE(a.class_id, '00000000-0000-0000-0000-000000000000') =
       COALESCE(b.class_id, '00000000-0000-0000-0000-000000000000')
   AND (a.updated_at, a.id) < (b.updated_at, b.id)
)
DELETE FROM public.submissions
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- 3) Database-level unique index: each faculty has at most one active submission per requirement per class
CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_active
ON public.submissions (
  faculty_profile_id,
  requirement_code,
  COALESCE(class_id, '00000000-0000-0000-0000-000000000000')
)
WHERE is_archived = false;
