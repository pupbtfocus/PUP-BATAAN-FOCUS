create table if not exists public.academic_terms (
  academic_year text not null,
  semester text not null,
  status text not null default 'Upcoming',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (academic_year, semester),
  constraint academic_terms_status_check check (status in ('Current', 'Upcoming', 'Archived'))
);
