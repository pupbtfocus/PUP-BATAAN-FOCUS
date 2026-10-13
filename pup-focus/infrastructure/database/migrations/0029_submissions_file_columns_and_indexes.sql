-- ====================================================================
-- Migration: 0029_submissions_file_columns_and_indexes.sql
-- Description: Applies the missing parts found by the DB scan:
--   * submissions file columns (0026 was never applied, document_versions is gone)
--   * submissions.is_read (0019)
--   * indexes + cascade FK for faster/cleaner deletes
-- Safe to re-run.
-- ====================================================================

alter table public.submissions
  add column if not exists storage_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists checksum_sha256 text,
  add column if not exists is_read boolean not null default false;

create index if not exists idx_submissions_faculty_profile_id on public.submissions(faculty_profile_id);
create index if not exists idx_submissions_faculty_assignment_id on public.submissions(faculty_assignment_id);
create index if not exists idx_submissions_requirement_code on public.submissions(requirement_code);
create index if not exists idx_review_decisions_submission_id on public.review_decisions(submission_id);
create index if not exists idx_faculty_program_assignments_faculty on public.faculty_program_assignments(faculty_profile_id);

-- Deleting a submission (or a faculty profile) also removes its reviews / submissions
alter table public.review_decisions drop constraint if exists review_decisions_submission_id_fkey;
alter table public.review_decisions
  add constraint review_decisions_submission_id_fkey
  foreign key (submission_id) references public.submissions(id) on delete cascade;

alter table public.submissions drop constraint if exists submissions_faculty_profile_id_fkey;
alter table public.submissions
  add constraint submissions_faculty_profile_id_fkey
  foreign key (faculty_profile_id) references public.profiles(id) on delete cascade;

alter table public.submissions drop constraint if exists submissions_faculty_assignment_id_fkey;
alter table public.submissions
  add constraint submissions_faculty_assignment_id_fkey
  foreign key (faculty_assignment_id) references public.faculty_program_assignments(id) on delete set null;

alter table public.faculty_program_assignments drop constraint if exists faculty_program_assignments_faculty_profile_id_fkey;
alter table public.faculty_program_assignments
  add constraint faculty_program_assignments_faculty_profile_id_fkey
  foreign key (faculty_profile_id) references public.profiles(id) on delete cascade;
