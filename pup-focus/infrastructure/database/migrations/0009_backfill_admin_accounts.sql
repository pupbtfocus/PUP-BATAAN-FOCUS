-- Migration: Backfill admin accounts into app_users and admins
-- Purpose: Ensure existing admin/super_admin users are visible in both tables

-- Backfill app_users from role mappings for admin and super_admin
with role_rows as (
  select
    p.user_id as auth_user_id,
    p.id as profile_id,
    p.email,
    p.full_name,
    r.code as role
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id
  join public.roles r on r.id = ur.role_id
  where r.code in ('admin', 'super_admin')
)
insert into public.app_users (
  auth_user_id,
  profile_id,
  email,
  full_name,
  role,
  created_at,
  updated_at
)
select
  rr.auth_user_id,
  rr.profile_id,
  rr.email,
  rr.full_name,
  rr.role,
  now(),
  now()
from role_rows rr
on conflict (email) do update
set auth_user_id = excluded.auth_user_id,
    profile_id = excluded.profile_id,
    full_name = excluded.full_name,
    role = excluded.role,
    updated_at = now();

-- Backfill admins table from role mappings for admin and super_admin
with admin_rows as (
  select
    p.id as profile_id,
    p.full_name,
    p.email
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id
  join public.roles r on r.id = ur.role_id
  where r.code in ('admin', 'super_admin')
)
insert into public.admins (
  profile_id,
  full_name,
  email,
  is_active,
  created_at,
  updated_at
)
select
  ar.profile_id,
  ar.full_name,
  ar.email,
  true,
  now(),
  now()
from admin_rows ar
on conflict (email) do update
set profile_id = excluded.profile_id,
    full_name = excluded.full_name,
    is_active = true,
    updated_at = now();
