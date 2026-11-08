-- Run once in Supabase SQL Editor
do $$
declare t text;
begin
  foreach t in array array[
    'submissions','submission_windows','submission_window_terms',
    'extension_requests','review_decisions','requirement_templates',
    'academic_terms','faculty_program_assignments','profiles',
    'notifications','transaction_logs'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
