-- Configurable submission window used by admin to control requirement uploads.
create table if not exists public.submission_windows (
  id smallint primary key default 1 check (id = 1),
  start_date date not null,
  end_date date not null,
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (start_date <= end_date)
);
