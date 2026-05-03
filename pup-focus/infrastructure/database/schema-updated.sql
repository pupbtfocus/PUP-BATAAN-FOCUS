-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.
-- UPDATED: Removed program_id, program_code, program_name from app_users and faculty tables

CREATE TABLE public.admin_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_profile_id uuid NOT NULL,
  program_id uuid,
  department text,
  assignment_type text NOT NULL DEFAULT 'program'::text,
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admin_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT admin_assignments_admin_profile_id_fkey FOREIGN KEY (admin_profile_id) REFERENCES public.profiles(id),
  CONSTRAINT admin_assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id)
);

CREATE TABLE public.admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  department text,
  permissions jsonb DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT admins_pkey PRIMARY KEY (id),
  CONSTRAINT admins_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.app_users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  auth_user_id uuid,
  profile_id uuid,
  email text NOT NULL UNIQUE,
  full_name text,
  role text NOT NULL CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'faculty'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT app_users_pkey PRIMARY KEY (id),
  CONSTRAINT app_users_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.compliance_template_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL,
  requirement_code text NOT NULL,
  requirement_name text NOT NULL,
  is_required boolean NOT NULL DEFAULT true,
  due_offset_days integer NOT NULL DEFAULT 30,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT compliance_template_items_pkey PRIMARY KEY (id),
  CONSTRAINT compliance_template_items_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curricula(id)
);

CREATE TABLE public.curricula (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT curricula_pkey PRIMARY KEY (id),
  CONSTRAINT curricula_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id)
);

CREATE TABLE public.faculty (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  user_id uuid,
  full_name text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT faculty_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.faculty_program_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  faculty_profile_id uuid NOT NULL,
  program_id uuid NOT NULL,
  curriculum_id uuid,
  academic_year text NOT NULL,
  term text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT faculty_program_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT faculty_program_assignments_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.programs(id),
  CONSTRAINT faculty_program_assignments_curriculum_id_fkey FOREIGN KEY (curriculum_id) REFERENCES public.curricula(id),
  CONSTRAINT faculty_program_assignments_faculty_profile_id_fkey FOREIGN KEY (faculty_profile_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  department_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.programs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT programs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT roles_pkey PRIMARY KEY (id)
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  role_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pkey PRIMARY KEY (id),
  CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id),
  CONSTRAINT user_roles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id)
);
