-- Migration 0020: Requirement Templates for Dynamic Requirement Checklist Builder

create table if not exists public.requirement_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  code text not null unique,
  description text,
  allowed_formats text[] not null default array['PDF', 'DOCX', 'XLSX'],
  max_size_mb integer not null default 5,
  is_mandatory boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for quick lookups
create index if not exists idx_requirement_templates_code on public.requirement_templates (code);
create index if not exists idx_requirement_templates_active on public.requirement_templates (is_active);

-- Seed standard default requirement templates if not existing
insert into public.requirement_templates (title, code, description, allowed_formats, max_size_mb, is_mandatory, is_active)
values
  (
    'Grade Sheets',
    'grade_sheet',
    'Official academic grade sheets signed and certified for the semester.',
    array['PDF', 'XLSX', 'DOCX'],
    10,
    true,
    true
  ),
  (
    'Enhanced Course Syllabus',
    'enhanced_syllabus',
    'OBE-compliant syllabus including course outcomes, grading system, and weekly schedule.',
    array['PDF', 'DOCX'],
    5,
    true,
    true
  ),
  (
    'Class Orientation Documentation',
    'class_orientation',
    'Narrative report and photo documentation of the initial class orientation.',
    array['PDF', 'DOCX', 'PNG', 'JPG'],
    10,
    true,
    true
  ),
  (
    'Midterm Examination Package',
    'midterm_package',
    'Copy of midterm examinations with Table of Specifications (TOS) and Answer Key.',
    array['PDF', 'DOCX'],
    10,
    true,
    true
  ),
  (
    'Final Examination Package',
    'final_package',
    'Copy of final examinations with Table of Specifications (TOS) and Answer Key.',
    array['PDF', 'DOCX'],
    10,
    true,
    true
  ),
  (
    'Class Records',
    'class_records',
    'Official class records showing midterm and final grade computations.',
    array['PDF', 'XLSX'],
    10,
    true,
    true
  )
on conflict (code) do nothing;
