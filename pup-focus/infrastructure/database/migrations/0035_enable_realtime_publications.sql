-- Migration 0035: Enable realtime publications for faculty and submissions tables
-- Enables Postgres replication / change data capture for Supabase Realtime safely

DO $$
DECLARE
  t text;
  target_tables text[] := ARRAY[
    'submissions',
    'profiles',
    'faculty',
    'faculty_classes',
    'classes',
    'submission_windows',
    'academic_terms',
    'extension_requests',
    'requirement_templates',
    'notifications',
    'review_decisions'
  ];
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY target_tables LOOP
      IF to_regclass('public.' || t) IS NOT NULL THEN
        BEGIN
          EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        EXCEPTION
          WHEN duplicate_object THEN
            -- Table is already in publication
          WHEN OTHERS THEN
            -- Safe catch for unsupported table types
        END;
      END IF;
    END LOOP;
  END IF;
END $$;
