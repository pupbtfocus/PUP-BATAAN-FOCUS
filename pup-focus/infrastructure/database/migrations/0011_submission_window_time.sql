alter table if exists public.submission_windows
  add column if not exists start_time time not null default '09:00:00',
  add column if not exists end_time time not null default '17:00:00';
