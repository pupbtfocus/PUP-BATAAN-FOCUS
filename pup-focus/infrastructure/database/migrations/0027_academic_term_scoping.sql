-- Migration 0027: Academic Term Scoping Rules
-- 1. Ensure only one Academic Term can be designated as active ('Current') at any given time via unique partial index.
-- 2. Ensure submission_windows has academic_year and semester columns to scope schedules to an academic term.
-- 3. Ensure submission_window_terms table exists to retain per-term schedule history.

-- Create partial unique index guaranteeing at most ONE active ('Current') term
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_academic_term
  ON public.academic_terms (status)
  WHERE status = 'Current';

-- Ensure submission_windows columns exist
ALTER TABLE IF EXISTS public.submission_windows
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS semester text;

-- Ensure submission_window_terms table exists
CREATE TABLE IF NOT EXISTS public.submission_window_terms (
  academic_year text NOT NULL,
  semester text NOT NULL,
  start_date text,
  end_date text,
  start_time text,
  end_time text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (academic_year, semester)
);

-- Enable RLS on submission_window_terms
ALTER TABLE public.submission_window_terms ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view terms
DROP POLICY IF EXISTS "Allow authenticated users to read submission window terms" ON public.submission_window_terms;
CREATE POLICY "Allow authenticated users to read submission window terms"
  ON public.submission_window_terms
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update terms
DROP POLICY IF EXISTS "Allow authenticated users to insert or update submission window terms" ON public.submission_window_terms;
CREATE POLICY "Allow authenticated users to insert or update submission window terms"
  ON public.submission_window_terms
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
