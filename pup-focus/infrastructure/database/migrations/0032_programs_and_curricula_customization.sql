-- Migration 0032: Add Customization and Visibility Columns to Programs and Curricula
-- Purpose: Support adding, hiding, and deleting academic programs and curricula

ALTER TABLE IF EXISTS public.programs
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.curricula
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS year_level TEXT DEFAULT '';

-- Indexes to improve lookup performance for active programs
CREATE INDEX IF NOT EXISTS idx_programs_is_hidden ON public.programs(is_hidden);
CREATE INDEX IF NOT EXISTS idx_curricula_program_hidden ON public.curricula(program_id, is_hidden);
