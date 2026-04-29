-- Migration: Disable RLS on app_users table
-- Purpose: Allow service-role client to insert/update user records
-- This ensures admin and faculty account creation properly inserts into app_users

alter table if exists public.app_users disable row level security;
