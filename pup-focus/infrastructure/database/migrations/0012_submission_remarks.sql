alter table if exists public.submissions
add column if not exists remarks text;
