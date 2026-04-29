-- Migration: Create dedicated admin account tables
-- Purpose: Establish admin account structure similar to faculty with dedicated tables
-- Adds: admins table, admin_assignments table, and data migration from app_users

-- Create admins table (similar to faculty but for admin accounts)
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  department text,
  permissions jsonb default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create admin_assignments table (similar to faculty_program_assignments)
-- For assigning admins to specific programs or organizational units
create table if not exists public.admin_assignments (
  id uuid primary key default gen_random_uuid(),
  admin_profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  department text,
  assignment_type text not null default 'program', -- 'program', 'department', 'system'
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (admin_profile_id, program_id, assignment_type)
);

-- Create indexes for performance
create index if not exists idx_admins_profile_id on public.admins(profile_id);
create index if not exists idx_admins_email on public.admins(email);
create index if not exists idx_admin_assignments_admin_profile_id on public.admin_assignments(admin_profile_id);
create index if not exists idx_admin_assignments_program_id on public.admin_assignments(program_id);

-- Disable RLS on admins and admin_assignments for service-role client
alter table if exists public.admins disable row level security;
alter table if exists public.admin_assignments disable row level security;

-- Migrate existing admin users from app_users to admins table
do $$
declare
  admin_profile record;
begin
  for admin_profile in 
    select 
      ap.profile_id,
      ap.full_name,
      ap.email
    from public.app_users ap
    where ap.role = 'admin'
      and ap.profile_id is not null
      and not exists (
        select 1 from public.admins a where a.profile_id = ap.profile_id
      )
  loop
    insert into public.admins (profile_id, full_name, email)
    values (admin_profile.profile_id, admin_profile.full_name, admin_profile.email)
    on conflict (email) do nothing;
  end loop;
end $$;

-- Migrate super_admin users as well (they can be admins too)
do $$
declare
  super_admin_profile record;
begin
  for super_admin_profile in 
    select 
      ap.profile_id,
      ap.full_name,
      ap.email
    from public.app_users ap
    where ap.role = 'super_admin'
      and ap.profile_id is not null
      and not exists (
        select 1 from public.admins a where a.profile_id = ap.profile_id
      )
  loop
    insert into public.admins (profile_id, full_name, email)
    values (super_admin_profile.profile_id, super_admin_profile.full_name, super_admin_profile.email)
    on conflict (email) do nothing;
  end loop;
end $$;
