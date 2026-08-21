-- Migration 0021: Automated Data Archiving & Backup Manager

create table if not exists public.system_backups (
  id uuid primary key default gen_random_uuid(),
  backup_name text not null,
  academic_year text,
  total_records integer not null default 0,
  file_size_kb integer not null default 0,
  file_url text,
  status text not null default 'completed' check (status in ('completed', 'failed', 'processing')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb
);

-- Index for sorting and quick lookups
create index if not exists idx_system_backups_created_at on public.system_backups (created_at desc);

-- Add is_archived columns if not existing
do $$
begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'academic_terms' and column_name = 'is_archived'
  ) then
    alter table public.academic_terms add column is_archived boolean not null default false;
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'submissions' and column_name = 'is_archived'
  ) then
    alter table public.submissions add column is_archived boolean not null default false;
  end if;
end $$;

-- Enable Row Level Security
alter table public.system_backups enable row level security;

-- Policy for system_backups
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'system_backups' and policyname = 'Admins and Super Admins can manage backups'
  ) then
    create policy "Admins and Super Admins can manage backups"
      on public.system_backups
      for all
      using (true)
      with check (true);
  end if;
end $$;
