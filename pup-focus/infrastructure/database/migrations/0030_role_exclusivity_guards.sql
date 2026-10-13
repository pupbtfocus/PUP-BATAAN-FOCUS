-- ====================================================================
-- Migration: 0030_role_exclusivity_guards.sql
-- Description: A profile is either faculty OR admin/super_admin, never both.
--   * blocks conflicting user_roles inserts
--   * blocks inserting a faculty profile into admins (and vice versa)
--   * removes faculty/admins rows when the matching role is removed
--   * cleans up any existing conflicts (admin wins only if there is no faculty role)
-- Safe to re-run.
-- ====================================================================

-- 0. Clean existing conflicts: if a profile has faculty + admin-class roles, keep faculty
delete from public.user_roles ur
using public.roles r, public.roles fr
where ur.role_id = r.id
  and r.code in ('admin', 'super_admin')
  and fr.code = 'faculty'
  and exists (
    select 1 from public.user_roles ur2
    where ur2.profile_id = ur.profile_id and ur2.role_id = fr.id
  );

delete from public.admins a
where not exists (
  select 1 from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.profile_id = a.profile_id and r.code in ('admin', 'super_admin')
);

delete from public.faculty f
where not exists (
  select 1 from public.user_roles ur
  join public.roles r on r.id = ur.role_id
  where ur.profile_id = f.profile_id and r.code = 'faculty'
);

-- 1. user_roles: reject faculty + admin/super_admin on the same profile
create or replace function public.guard_role_exclusivity()
returns trigger
language plpgsql
as $$
declare
  v_new text;
  v_conflict boolean;
begin
  select code into v_new from public.roles where id = new.role_id;

  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = new.profile_id
      and ur.role_id <> new.role_id
      and (
        (v_new = 'faculty' and r.code in ('admin', 'super_admin'))
        or (v_new in ('admin', 'super_admin') and r.code = 'faculty')
      )
  ) into v_conflict;

  if v_conflict then
    raise exception 'Profile % cannot hold both faculty and admin roles (attempted: %)', new.profile_id, v_new
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_role_exclusivity on public.user_roles;
create trigger trg_guard_role_exclusivity
before insert or update on public.user_roles
for each row execute function public.guard_role_exclusivity();

-- 2. admins / faculty: only profiles that actually hold the matching role
create or replace function public.guard_account_table_role()
returns trigger
language plpgsql
as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.profile_id = new.profile_id
      and (
        (tg_table_name = 'admins' and r.code in ('admin', 'super_admin'))
        or (tg_table_name = 'faculty' and r.code = 'faculty')
      )
  ) into v_ok;

  if not v_ok then
    raise exception 'Profile % has no matching role for table %', new.profile_id, tg_table_name
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_admins_role on public.admins;
create trigger trg_guard_admins_role
before insert on public.admins
for each row execute function public.guard_account_table_role();

drop trigger if exists trg_guard_faculty_role on public.faculty;
create trigger trg_guard_faculty_role
before insert on public.faculty
for each row execute function public.guard_account_table_role();

-- 3. Removing a role removes the matching account-table row
create or replace function public.cleanup_account_tables_on_role_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  select code into v_code from public.roles where id = old.role_id;

  if v_code = 'faculty' then
    delete from public.faculty where profile_id = old.profile_id;
  elsif v_code in ('admin', 'super_admin') then
    if not exists (
      select 1 from public.user_roles ur
      join public.roles r on r.id = ur.role_id
      where ur.profile_id = old.profile_id
        and ur.id <> old.id
        and r.code in ('admin', 'super_admin')
    ) then
      delete from public.admins where profile_id = old.profile_id;
    end if;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_cleanup_account_tables on public.user_roles;
create trigger trg_cleanup_account_tables
after delete on public.user_roles
for each row execute function public.cleanup_account_tables_on_role_delete();
