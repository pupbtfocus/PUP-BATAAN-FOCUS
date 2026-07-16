-- Track each academic year and semester that has been used for a submission window.
create table if not exists public.submission_window_terms (
  academic_year text not null,
  semester text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (academic_year, semester)
);