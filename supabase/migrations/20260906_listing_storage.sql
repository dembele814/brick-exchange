insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true;

create policy "public listing images" on storage.objects for select using (bucket_id = 'listing-images');
create policy "seller uploads listing images" on storage.objects for insert to authenticated with check (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "seller deletes own images" on storage.objects for delete to authenticated using (
  bucket_id = 'listing-images' and (storage.foldername(name))[1] = auth.uid()::text
);
