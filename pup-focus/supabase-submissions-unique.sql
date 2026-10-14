-- 1) Remove pending placeholders that already have an uploaded/reviewed sibling
DELETE FROM public.submissions p
WHERE p.status = 'pending'
  AND p.storage_path IS NULL
  AND p.class_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.submissions s
    WHERE s.id <> p.id
      AND s.faculty_profile_id = p.faculty_profile_id
      AND s.requirement_code = p.requirement_code
      AND s.is_archived = p.is_archived
      AND s.storage_path IS NOT NULL
  );

-- 2) Remove remaining exact duplicates (keeping the newest one)
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

-- 3) Database-level unique index to permanently block future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS submissions_unique_active
ON public.submissions (
  faculty_profile_id,
  requirement_code,
  COALESCE(class_id, '00000000-0000-0000-0000-000000000000')
)
WHERE is_archived = false;
