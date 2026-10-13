-- Storage policies for `faculty-submissions` and `profile-pictures`.
-- Run in the Supabase SQL editor. Safe to re-run.
-- Note: the Next.js server uses the service-role key (bypasses RLS); these policies
-- protect direct client access and act as defence-in-depth.
--
-- Path layouts (bucket-relative):
--   faculty-submissions: faculty-submissions/<profile_id>/<submission_id>/<file>
--   profile-pictures:    (admin|faculty)-profile-images/<email>/<file>

-- ---------------------------------------------------------------
-- Buckets (private, with limits)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('faculty-submissions', 'faculty-submissions', false, 52428800, null),
  ('profile-pictures', 'profile-pictures', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------
-- Helpers (roles come from user_roles, NOT user_metadata, which users can edit)
-- ---------------------------------------------------------------
create or replace function public.storage_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.user_roles ur on ur.profile_id = p.id
    join public.roles r on r.id = ur.role_id
    where p.user_id = auth.uid()
      and r.code in ('admin', 'super_admin')
  );
$$;

create or replace function public.storage_current_profile_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.id::text from public.profiles p where p.user_id = auth.uid() limit 1;
$$;

revoke all on function public.storage_is_admin() from public;
revoke all on function public.storage_current_profile_id() from public;
grant execute on function public.storage_is_admin() to authenticated;
grant execute on function public.storage_current_profile_id() to authenticated;

-- ---------------------------------------------------------------
-- Remove old policies on these two buckets
-- ---------------------------------------------------------------
do $$
declare pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') ilike '%faculty-submissions%'
        or coalesce(with_check, '') ilike '%faculty-submissions%'
        or coalesce(qual, '') ilike '%profile-pictures%'
        or coalesce(with_check, '') ilike '%profile-pictures%'
        or coalesce(qual, '') ilike '%compliance-private%'
        or coalesce(with_check, '') ilike '%compliance-private%')
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------
-- faculty-submissions: faculty manage own folder, admins read/manage all
-- ---------------------------------------------------------------
create policy "faculty_submissions_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'faculty-submissions'
  and (
    (storage.foldername(name))[2] = public.storage_current_profile_id()
    or public.storage_is_admin()
  )
);

create policy "faculty_submissions_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'faculty-submissions'
  and (
    (storage.foldername(name))[2] = public.storage_current_profile_id()
    or public.storage_is_admin()
  )
);

create policy "faculty_submissions_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'faculty-submissions'
  and (
    (storage.foldername(name))[2] = public.storage_current_profile_id()
    or public.storage_is_admin()
  )
)
with check (
  bucket_id = 'faculty-submissions'
  and (
    (storage.foldername(name))[2] = public.storage_current_profile_id()
    or public.storage_is_admin()
  )
);

-- Only admins may delete submitted files (prevents faculty removing evidence)
create policy "faculty_submissions_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'faculty-submissions'
  and public.storage_is_admin()
);

-- ---------------------------------------------------------------
-- profile-pictures: any signed-in user can view; users manage their own
-- <kind>-profile-images/<email>/ folder; admins manage all
-- ---------------------------------------------------------------
create policy "profile_pictures_select"
on storage.objects for select to authenticated
using (bucket_id = 'profile-pictures');

create policy "profile_pictures_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-pictures'
  and (
    lower((storage.foldername(name))[2]) = lower(auth.jwt() ->> 'email')
    or public.storage_is_admin()
  )
);

create policy "profile_pictures_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-pictures'
  and (
    lower((storage.foldername(name))[2]) = lower(auth.jwt() ->> 'email')
    or public.storage_is_admin()
  )
)
with check (
  bucket_id = 'profile-pictures'
  and (
    lower((storage.foldername(name))[2]) = lower(auth.jwt() ->> 'email')
    or public.storage_is_admin()
  )
);

create policy "profile_pictures_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-pictures'
  and (
    lower((storage.foldername(name))[2]) = lower(auth.jwt() ->> 'email')
    or public.storage_is_admin()
  )
);
