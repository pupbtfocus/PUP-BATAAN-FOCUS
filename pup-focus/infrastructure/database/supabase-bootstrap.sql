-- PUP FOCUS Supabase bootstrap script
-- Run this directly in the Supabase SQL Editor on a fresh project.
-- It creates the core schema, seeds roles/program/curriculum requirements,
-- and inserts a default admin account.

create extension if not exists pgcrypto;

-- =========================================================
-- Core identity and access tables
-- =========================================================
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  full_name text not null,
  email text not null unique,
  department_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, role_id)
);

-- =========================================================
-- Academic structure
-- =========================================================
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.curricula (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (program_id, code)
);

create table if not exists public.faculty_program_assignments (
  id uuid primary key default gen_random_uuid(),
  faculty_profile_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  curriculum_id uuid references public.curricula(id) on delete set null,
  academic_year text not null,
  term text not null,
  created_at timestamptz not null default now(),
  unique (faculty_profile_id, program_id, academic_year, term)
);

-- =========================================================
-- Curriculum-based requirements
-- =========================================================
create table if not exists public.compliance_template_items (
  id uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  requirement_code text not null,
  requirement_name text not null,
  is_required boolean not null default true,
  due_offset_days integer not null default 30,
  created_at timestamptz not null default now(),
  unique (curriculum_id, requirement_code)
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  faculty_profile_id uuid not null references public.profiles(id) on delete cascade,
  faculty_assignment_id uuid references public.faculty_program_assignments(id) on delete set null,
  curriculum_id uuid not null references public.curricula(id) on delete cascade,
  requirement_code text not null,
  status text not null default 'draft',
  due_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  version_number integer not null,
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null,
  checksum_sha256 text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (submission_id, version_number)
);

create table if not exists public.review_decisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null,
  remarks text,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Support tables
-- =========================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Helpful indexes
-- =========================================================
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_user_roles_profile_id on public.user_roles(profile_id);
create index if not exists idx_faculty_program_assignments_faculty on public.faculty_program_assignments(faculty_profile_id);
create index if not exists idx_submissions_faculty on public.submissions(faculty_profile_id);
create index if not exists idx_document_versions_submission on public.document_versions(submission_id);

-- =========================================================
-- Roles seed
-- =========================================================
insert into public.roles (code, name) values
  ('super_admin', 'Super Admin'),
  ('faculty', 'Faculty'),
  ('program_head', 'Program Head'),
  ('admin', 'Admin')
on conflict (code) do nothing;

-- =========================================================
-- Sample academic structure
-- =========================================================
insert into public.programs (code, name) values
  ('BSIT', 'BS Information Technology'),
  ('BSBA', 'BS Business Administration'),
  ('BSE', 'BS Entrepreneurship'),
  ('BSA', 'BS Accountancy')
on conflict (code) do nothing;

insert into public.curricula (program_id, code, name, is_active)
select p.id, 'CURR-2026-A', '2026 Curriculum', true
from public.programs p
where p.code = 'BSIT'
on conflict (program_id, code) do nothing;

insert into public.compliance_template_items (
  curriculum_id,
  requirement_code,
  requirement_name,
  is_required,
  due_offset_days
)
select c.id, req.requirement_code, req.requirement_name, true, req.due_offset_days
from public.curricula c
cross join (
  values
    ('grade_sheet', 'Gradesheets', 14),
    ('enhanced_syllabus', 'Enhanced Course Syllabus (if not yet submitted)', 7),
    ('class_orientation', 'Class Orientation Documentation (photos and narrative report)', 14),
    ('midterm_package', 'Copy of Midterm Examinations with TOS and Answer Key', 21),
    ('final_package', 'Copy of Final Examinations with TOS and Answer Key', 21),
    ('class_records', 'Class Records (illustrating the midterm and final computations)', 30)
) as req(requirement_code, requirement_name, due_offset_days)
where c.code = 'CURR-2026-A'
on conflict (curriculum_id, requirement_code) do nothing;

-- =========================================================
-- Default super admin account
-- Change these values before running if you want a different super admin.
-- =========================================================
do $$
declare
  super_admin_user_id uuid := '6f0c9e6a-6d9f-4d4f-9cb2-b2b1f2f9a001';
  super_admin_profile_id uuid := '6f0c9e6a-6d9f-4d4f-9cb2-b2b1f2f9a002';
  super_admin_email text := 'superadmin@pup-focus.local';
  super_admin_password text := 'SuperAdmin123!';
  super_admin_role_id uuid;
begin
  select id into super_admin_role_id
  from public.roles
  where code = 'super_admin'
  limit 1;

  if super_admin_role_id is null then
    raise exception 'Super admin role not found. Run role seed first.';
  end if;

  insert into auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) values (
    super_admin_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    super_admin_email,
    crypt(super_admin_password, gen_salt('bf')),
    now(),
    null,
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('full_name', 'PUP FOCUS Super Admin', 'role', 'super_admin'),
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  on conflict (id) do nothing;

  insert into public.profiles (
    id,
    user_id,
    full_name,
    email,
    created_at,
    updated_at
  ) values (
    super_admin_profile_id,
    super_admin_user_id,
    'PUP FOCUS Super Admin',
    super_admin_email,
    now(),
    now()
  )
  on conflict (user_id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();

  insert into public.user_roles (profile_id, role_id)
  values (super_admin_profile_id, super_admin_role_id)
  on conflict do nothing;
end $$;

-- =========================================================
-- Optional RLS baseline
-- Enable after you are ready to enforce role-based access.
-- =========================================================
-- Note: Disabled RLS on profiles, user_roles, and faculty_program_assignments
-- to allow service role client to create and manage faculty accounts.
-- These should be re-enabled with proper policies once role-based access is configured.
-- alter table public.profiles enable row level security;
alter table public.submissions enable row level security;
alter table public.document_versions enable row level security;
alter table public.review_decisions enable row level security;

-- Super admin account credentials for first login:
-- email: superadmin@pup-focus.local
-- password: SuperAdmin123!
