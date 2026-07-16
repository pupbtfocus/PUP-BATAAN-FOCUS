-- Add academic year and semester metadata to the submission window record.
alter table if exists public.submission_windows
  add column if not exists academic_year text,
  add column if not exists semester text;
