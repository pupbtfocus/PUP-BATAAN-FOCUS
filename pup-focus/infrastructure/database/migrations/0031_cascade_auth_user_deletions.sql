-- Migration 0031: Enforce CASCADE / SET NULL on all Foreign Keys to auth.users

-- 1. Profiles -> auth.users (CASCADE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'user_id') THEN
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 2. Audit Logs -> auth.users (SET NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'audit_logs' AND column_name = 'actor_id') THEN
      ALTER TABLE public.audit_logs
        ADD CONSTRAINT audit_logs_actor_id_fkey
        FOREIGN KEY (actor_id)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 3. Notifications -> auth.users (CASCADE)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'user_id') THEN
      ALTER TABLE public.notifications
        ADD CONSTRAINT notifications_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

-- 4. Submission Windows -> auth.users (SET NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_windows') THEN
    ALTER TABLE public.submission_windows DROP CONSTRAINT IF EXISTS submission_windows_updated_by_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submission_windows' AND column_name = 'updated_by') THEN
      ALTER TABLE public.submission_windows
        ADD CONSTRAINT submission_windows_updated_by_fkey
        FOREIGN KEY (updated_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 5. Submission Window Used Terms -> auth.users (SET NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_window_used_terms') THEN
    ALTER TABLE public.submission_window_used_terms DROP CONSTRAINT IF EXISTS submission_window_used_terms_created_by_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submission_window_used_terms' AND column_name = 'created_by') THEN
      ALTER TABLE public.submission_window_used_terms
        ADD CONSTRAINT submission_window_used_terms_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 6. Submission Window Logs -> auth.users (SET NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_window_logs') THEN
    ALTER TABLE public.submission_window_logs DROP CONSTRAINT IF EXISTS submission_window_logs_extended_by_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'submission_window_logs' AND column_name = 'extended_by') THEN
      ALTER TABLE public.submission_window_logs
        ADD CONSTRAINT submission_window_logs_extended_by_fkey
        FOREIGN KEY (extended_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 7. Academic Terms -> auth.users (SET NULL)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_terms') THEN
    ALTER TABLE public.academic_terms DROP CONSTRAINT IF EXISTS academic_terms_created_by_fkey;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'academic_terms' AND column_name = 'created_by') THEN
      ALTER TABLE public.academic_terms
        ADD CONSTRAINT academic_terms_created_by_fkey
        FOREIGN KEY (created_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 8. Extension Requests -> auth.users
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_requests') THEN
    ALTER TABLE public.extension_requests DROP CONSTRAINT IF EXISTS extension_requests_faculty_user_id_fkey;
    ALTER TABLE public.extension_requests DROP CONSTRAINT IF EXISTS extension_requests_reviewed_by_fkey;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'extension_requests' AND column_name = 'faculty_user_id') THEN
      ALTER TABLE public.extension_requests
        ADD CONSTRAINT extension_requests_faculty_user_id_fkey
        FOREIGN KEY (faculty_user_id)
        REFERENCES auth.users(id)
        ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'extension_requests' AND column_name = 'reviewed_by') THEN
      ALTER TABLE public.extension_requests
        ADD CONSTRAINT extension_requests_reviewed_by_fkey
        FOREIGN KEY (reviewed_by)
        REFERENCES auth.users(id)
        ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

-- 9. Storage Objects -> auth.users (owner column fix)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
    ALTER TABLE storage.objects DROP CONSTRAINT IF EXISTS objects_owner_fkey;
    ALTER TABLE storage.objects
      ADD CONSTRAINT objects_owner_fkey
      FOREIGN KEY (owner)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore storage schema permissions error if run by non-superuser
    NULL;
END $$;

-- 10. Clean up and delete test account qa.admin1@pupfocus.dev
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'qa.admin1@pupfocus.dev';
  
  IF target_user_id IS NOT NULL THEN
    -- Clear references
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
      UPDATE public.audit_logs SET actor_id = NULL WHERE actor_id = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_windows') THEN
      UPDATE public.submission_windows SET updated_by = NULL WHERE updated_by = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_window_logs') THEN
      UPDATE public.submission_window_logs SET extended_by = NULL WHERE extended_by = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submission_window_used_terms') THEN
      UPDATE public.submission_window_used_terms SET created_by = NULL WHERE created_by = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_terms') THEN
      UPDATE public.academic_terms SET created_by = NULL WHERE created_by = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'extension_requests') THEN
      UPDATE public.extension_requests SET reviewed_by = NULL WHERE reviewed_by = target_user_id;
      DELETE FROM public.extension_requests WHERE faculty_user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
      DELETE FROM public.notifications WHERE user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_roles') THEN
      DELETE FROM public.user_roles WHERE profile_id = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'faculty') THEN
      DELETE FROM public.faculty WHERE profile_id = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'app_users') THEN
      DELETE FROM public.app_users WHERE profile_id = target_user_id OR auth_user_id = target_user_id;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
      DELETE FROM public.profiles WHERE id = target_user_id;
    END IF;

    -- Clear storage objects owner
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
      UPDATE storage.objects SET owner = NULL WHERE owner = target_user_id;
    END IF;

    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
  END IF;
END $$;
