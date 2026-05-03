-- Migration: Remove program assignment columns from app_users and faculty tables
-- Date: 2026-05-03
-- Description: Faculty no longer need program assignments. Removed program_id, program_code, and program_name columns.

-- Remove columns from app_users table
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_program_id_fkey;
ALTER TABLE public.app_users DROP COLUMN IF EXISTS program_id;
ALTER TABLE public.app_users DROP COLUMN IF EXISTS program_code;
ALTER TABLE public.app_users DROP COLUMN IF EXISTS program_name;

-- Remove columns from faculty table
ALTER TABLE public.faculty DROP COLUMN IF EXISTS program_id;
ALTER TABLE public.faculty DROP COLUMN IF EXISTS program_code;
ALTER TABLE public.faculty DROP COLUMN IF EXISTS program_name;

-- Note: faculty_program_assignments table is kept for backward compatibility but is no longer actively used
