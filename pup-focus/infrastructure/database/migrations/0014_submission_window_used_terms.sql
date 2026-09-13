-- Track each academic year and semester that has been used for a submission window.
create table if not exists public.submission_window_terms (
  academic_year text not null,
  semester text not null,
  start_date text,
  end_date text,
  start_time text,
  end_time text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (academic_year, semester)
);

-- Enable Row Level Security
alter table public.submission_window_terms enable row level security;

-- Allow authenticated users to view terms
create policy "Allow authenticated users to read submission window terms"
  on public.submission_window_terms
  for select
  to authenticated
  using (true);

-- Allow authenticated users to insert/update terms
create policy "Allow authenticated users to insert or update submission window terms"
  on public.submission_window_terms
  for all
  to authenticated
  using (true)
  with check (true);