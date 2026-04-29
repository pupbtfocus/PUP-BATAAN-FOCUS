-- Migration: Disable RLS on core tables for faculty management
-- Purpose: Allow service role client to create and manage faculty accounts
-- This should be re-enabled with proper policies once role-based access is fully configured

alter table public.profiles disable row level security;
alter table public.user_roles disable row level security;
alter table public.faculty_program_assignments disable row level security;
