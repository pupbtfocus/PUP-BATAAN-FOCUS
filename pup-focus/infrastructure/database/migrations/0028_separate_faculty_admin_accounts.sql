-- ====================================================================
-- Migration: 0028_separate_faculty_admin_accounts.sql
-- Description: `profiles` stays the shared identity table. Faculty and admin
--              accounts get their own tables (`faculty`, `admins`), kept in sync
--              automatically from `user_roles`. Safe to re-run.
-- ====================================================================

-- 1. Faculty table (create or extend the existing one)
create table if not exists public.faculty (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  user_id uuid,
  full_name text not null,
  email text not null,
  department text,
  is_active boolean not null default true,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.faculty
  add column if not exists user_id uuid,
  add column if not exists department text,
  add column if not exists is_active boolean not null default true,
  add column if not exists metadata jsonb default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

-- One faculty row per profile (drop older duplicates first)
delete from public.faculty f
using public.faculty d
where f.profile_id = d.profile_id and f.created_at > d.created_at;

create unique index if not exists faculty_profile_id_key on public.faculty(profile_id);
create index if not exists idx_faculty_email on public.faculty(email);

-- Cascade so deleting a profile removes its faculty/admin row
alter table public.faculty drop constraint if exists faculty_profile_id_fkey;
alter table public.faculty
  add constraint faculty_profile_id_fkey
  foreign key (profile_id) references public.profiles(id) on delete cascade;

-- Server uses the service role; block direct anon access, allow users to read their own row
alter table public.faculty enable row level security;
drop policy if exists "faculty_select_own" on public.faculty;
create policy "faculty_select_own" on public.faculty
  for select to authenticated using (user_id = auth.uid());

-- 2. Keep faculty/admins in sync whenever a role is granted
create or replace function public.sync_account_tables_from_user_roles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_profile record;
begin
  select code into v_code from public.roles where id = new.role_id;
  select id, user_id, full_name, email into v_profile
  from public.profiles where id = new.profile_id;

  if v_profile.id is null then
    return new;
  end if;

  if v_code = 'faculty' then
    insert into public.faculty (profile_id, user_id, full_name, email)
    values (v_profile.id, v_profile.user_id, v_profile.full_name, v_profile.email)
    on conflict (profile_id) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          user_id = excluded.user_id,
          updated_at = now();
  elsif v_code in ('admin', 'super_admin') then
    insert into public.admins (profile_id, full_name, email)
    values (v_profile.id, v_profile.full_name, v_profile.email)
    on conflict (profile_id) do update
      set full_name = excluded.full_name,
          email = excluded.email,
          updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_account_tables on public.user_roles;
create trigger trg_sync_account_tables
after insert on public.user_roles
for each row execute function public.sync_account_tables_from_user_roles();

-- 3. Backfill missing user_roles from the role stored in auth metadata
--    (fires the trigger above, which fills faculty/admins)
insert into public.user_roles (profile_id, role_id)
select p.id, r.id
from public.profiles p
join auth.users u on u.id = p.user_id
join public.roles r
  on r.code = coalesce(u.raw_user_meta_data ->> 'role', u.raw_app_meta_data ->> 'role')
where not exists (
  select 1 from public.user_roles ur where ur.profile_id = p.id and ur.role_id = r.id
);

-- 4. Backfill account tables for roles that already existed
insert into public.faculty (profile_id, user_id, full_name, email)
select p.id, p.user_id, p.full_name, p.email
from public.profiles p
join public.user_roles ur on ur.profile_id = p.id
join public.roles r on r.id = ur.role_id and r.code = 'faculty'
on conflict (profile_id) do nothing;

insert into public.admins (profile_id, full_name, email)
select p.id, p.full_name, p.email
from public.profiles p
join public.user_roles ur on ur.profile_id = p.id
join public.roles r on r.id = ur.role_id and r.code in ('admin', 'super_admin')
on conflict do nothing;
