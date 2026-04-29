-- Consolidate user lifecycle fixes:
-- 1) Create app_users table (if missing)
-- 2) Enforce cascade behavior for profile-linked tables
-- 3) Link profiles.user_id -> auth.users(id) with ON DELETE CASCADE
-- 4) Add trigger cleanup for app_users on profile delete (extra safety)

create extension if not exists pgcrypto;

-- Create consolidated application users table.
create table if not exists public.app_users (
  id uuid not null default gen_random_uuid(),
  auth_user_id uuid null,
  profile_id uuid null,
  email text not null,
  full_name text null,
  role text not null,
  program_id uuid null,
  program_code text null,
  program_name text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  metadata jsonb null default '{}'::jsonb,
  constraint app_users_pkey primary key (id),
  constraint app_users_email_key unique (email),
  constraint app_users_role_check check (
    role = any (array['super_admin'::text, 'admin'::text, 'faculty'::text])
  )
);

create index if not exists idx_app_users_program_id
  on public.app_users using btree (program_id);

create index if not exists idx_app_users_profile_id
  on public.app_users using btree (profile_id);

-- Attach profile/program FKs for app_users if table exists.
do $$
begin
  if to_regclass('public.app_users') is not null then
    alter table public.app_users
      drop constraint if exists app_users_profile_id_fkey;
    alter table public.app_users
      add constraint app_users_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete cascade;

    alter table public.app_users
      drop constraint if exists app_users_program_id_fkey;
    alter table public.app_users
      add constraint app_users_program_id_fkey
      foreign key (program_id)
      references public.programs(id);
  end if;
end $$;

-- Ensure profile-dependent tables cascade when a profile is deleted.
do $$
begin
  if to_regclass('public.user_roles') is not null then
    alter table public.user_roles
      drop constraint if exists user_roles_profile_id_fkey;
    alter table public.user_roles
      add constraint user_roles_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete cascade;
  end if;

  if to_regclass('public.faculty_program_assignments') is not null then
    alter table public.faculty_program_assignments
      drop constraint if exists faculty_program_assignments_faculty_profile_id_fkey;
    alter table public.faculty_program_assignments
      add constraint faculty_program_assignments_faculty_profile_id_fkey
      foreign key (faculty_profile_id)
      references public.profiles(id)
      on delete cascade;
  end if;

  if to_regclass('public.faculty') is not null then
    alter table public.faculty
      drop constraint if exists faculty_profile_id_fkey;
    alter table public.faculty
      add constraint faculty_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete cascade;
  end if;
end $$;

-- Remove orphan profile records that reference missing auth users.
-- This is required before adding profiles_user_id_fkey.
delete from public.profiles p
where not exists (
  select 1
  from auth.users u
  where u.id = p.user_id
);

-- Remove app_users rows that are detached from both profiles and auth users.
delete from public.app_users a
where a.profile_id is null
  and (
    a.auth_user_id is null
    or not exists (
      select 1
      from auth.users u
      where u.id = a.auth_user_id
    )
  );

-- Ensure profiles are anchored to auth.users and auto-cleaned on auth delete.
do $$
begin
  if to_regclass('public.profiles') is not null then
    alter table public.profiles
      drop constraint if exists profiles_user_id_fkey;
    alter table public.profiles
      add constraint profiles_user_id_fkey
      foreign key (user_id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

-- Extra safety: remove app_users rows when a profile is deleted.
create or replace function public.cleanup_app_users_on_profile_delete()
returns trigger
language plpgsql
as $$
begin
  delete from public.app_users
  where profile_id = old.id
     or auth_user_id = old.user_id;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_app_users_on_profile_delete on public.profiles;
create trigger trg_cleanup_app_users_on_profile_delete
after delete on public.profiles
for each row
execute function public.cleanup_app_users_on_profile_delete();

-- Backfill app_users from current role/program structure.
with role_rows as (
  select
    p.user_id as auth_user_id,
    p.id as profile_id,
    p.email,
    p.full_name,
    r.code as role,
    fpa.program_id,
    pr.code as program_code,
    pr.name as program_name
  from public.profiles p
  join public.user_roles ur on ur.profile_id = p.id
  join public.roles r on r.id = ur.role_id
  left join public.faculty_program_assignments fpa on fpa.faculty_profile_id = p.id
  left join public.programs pr on pr.id = fpa.program_id
  where r.code in ('super_admin', 'admin', 'faculty')
)
insert into public.app_users (
  auth_user_id,
  profile_id,
  email,
  full_name,
  role,
  program_id,
  program_code,
  program_name,
  created_at,
  updated_at
)
select
  rr.auth_user_id,
  rr.profile_id,
  rr.email,
  rr.full_name,
  rr.role,
  rr.program_id,
  rr.program_code,
  rr.program_name,
  now(),
  now()
from role_rows rr
on conflict (email) do update
set auth_user_id = excluded.auth_user_id,
    profile_id = excluded.profile_id,
    full_name = excluded.full_name,
    role = excluded.role,
    program_id = excluded.program_id,
    program_code = excluded.program_code,
    program_name = excluded.program_name,
    updated_at = now();
