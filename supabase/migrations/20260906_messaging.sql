alter table public.conversations add column if not exists buyer_id uuid references public.profiles(id) on delete cascade;
alter table public.conversations drop constraint if exists conversations_listing_id_key;
create unique index if not exists conversations_listing_buyer_unique on public.conversations(listing_id, buyer_id);

create policy "participants see participant list" on public.conversation_participants
  for select using (exists(select 1 from public.conversation_participants self where self.conversation_id = conversation_id and self.user_id = auth.uid()));
create policy "participant updates own receipt" on public.conversation_participants
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.start_conversation(p_listing_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_conversation uuid;
begin
  select seller_id into v_seller from public.listings where id = p_listing_id and status = 'active';
  if v_seller is null then raise exception 'Oferta nie jest dostępna'; end if;
  if v_seller = auth.uid() then raise exception 'Nie możesz napisać do siebie'; end if;
  select id into v_conversation from public.conversations where listing_id = p_listing_id and buyer_id = auth.uid();
  if v_conversation is not null then return v_conversation; end if;
  insert into public.conversations(listing_id, buyer_id) values (p_listing_id, auth.uid()) returning id into v_conversation;
  insert into public.conversation_participants(conversation_id, user_id) values (v_conversation, auth.uid()), (v_conversation, v_seller);
  return v_conversation;
end; $$;
grant execute on function public.start_conversation(uuid) to authenticated;
