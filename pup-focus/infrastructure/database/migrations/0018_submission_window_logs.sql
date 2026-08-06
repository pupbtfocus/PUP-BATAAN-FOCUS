-- Track extensions granted to submission windows by admins/program heads.
create table if not exists public.submission_window_logs (
  id uuid primary key default gen_random_uuid(),
  submission_window_id smallint references public.submission_windows(id) on delete cascade default 1,
  action_type text not null default 'EXTENSION',
  extended_by uuid references auth.users(id),
  extended_by_name text,
  old_end_date date,
  old_end_time text,
  new_end_date date not null,
  new_end_time text not null,
  scope text not null default 'global', -- 'global', 'program', 'faculty'
  scope_target text, -- e.g. program code "BSIT" or faculty name / profile id
  reason text not null, -- 'System Maintenance', 'Weather Suspension', 'Department Request', 'Individual Waiver', etc.
  reason_details text,
  extension_preset text, -- '+24 Hours', '+48 Hours', '+3 Days', '+1 Week', 'Custom'
  notified_faculty boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

-- Index for quick lookup of extension logs
create index if not exists idx_submission_window_logs_created_at
  on public.submission_window_logs(created_at desc);
