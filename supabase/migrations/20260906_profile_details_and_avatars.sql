-- Private account fields never appear in the public profiles table.
alter table public.private_profiles
  add column if not exists gender text check (gender in ('Kobieta', 'Mężczyzna', 'Nie podaję'));

-- Public avatars are deliberately limited to a single image per account.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "avatar images are public"
on storage.objects for select using (bucket_id = 'avatars');

create policy "users upload their own avatar"
on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users replace their own avatar"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "users remove their own avatar"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
