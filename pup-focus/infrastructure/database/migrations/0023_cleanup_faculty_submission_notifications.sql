-- Migration: 0023_cleanup_faculty_submission_notifications.sql
-- Purpose: Remove legacy/test 'NEW_SUBMISSION' / 'submission_uploaded' notification records
-- that were mistakenly delivered to faculty user IDs.

DELETE FROM public.notifications n
WHERE (
  n.type IN ('NEW_SUBMISSION', 'SUBMISSION_CREATED', 'FACULTY_SUBMITTED', 'submission_uploaded', 'new_submission', 'submission_created', 'faculty_submitted')
  OR n.title ILIKE 'New Submission from%'
)
AND EXISTS (
  SELECT 1
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  JOIN public.profiles p ON p.id = ur.profile_id
  WHERE p.user_id = n.user_id
    AND r.code = 'faculty'
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles ur2
      JOIN public.roles r2 ON r2.id = ur2.role_id
      WHERE ur2.profile_id = p.id
        AND r2.code IN ('admin', 'super_admin')
    )
);
