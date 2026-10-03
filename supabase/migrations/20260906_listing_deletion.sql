create policy "seller deletes own listing" on public.listings
  for delete using (seller_id = auth.uid());
