-- Add super_admin role and promote default bootstrap admin account.

insert into roles (code, name)
values
  ('super_admin', 'Super Admin'),
  ('admin', 'Admin')
on conflict (code) do update
set name = excluded.name;

-- Promote legacy default admin account (if present) to super admin.
with role_ids as (
  select
    (select id from roles where code = 'super_admin' limit 1) as super_admin_role_id,
    (select id from roles where code = 'admin' limit 1) as admin_role_id
),
default_profile as (
  select id
  from profiles
  where email = 'admin@pup-focus.local'
  limit 1
)
insert into user_roles (profile_id, role_id)
select p.id, r.super_admin_role_id
from default_profile p
cross join role_ids r
where r.super_admin_role_id is not null
on conflict do nothing;

update auth.users
set raw_user_meta_data = jsonb_set(
  coalesce(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"super_admin"'::jsonb,
  true
)
where email = 'admin@pup-focus.local';
