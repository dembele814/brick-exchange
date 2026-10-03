begin;

alter table public.messages
  add column if not exists message_type text not null default 'text',
  add column if not exists image_path text,
  add column if not exists offer_amount_grosz integer,
  add column if not exists offer_status text;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'price_offer'));
alter table public.messages drop constraint if exists messages_offer_amount_check;
alter table public.messages add constraint messages_offer_amount_check
  check (offer_amount_grosz is null or offer_amount_grosz >= 100);
alter table public.messages drop constraint if exists messages_offer_status_check;
alter table public.messages add constraint messages_offer_status_check
  check (offer_status is null or offer_status in ('pending', 'accepted', 'rejected'));
alter table public.messages drop constraint if exists messages_content_shape_check;
alter table public.messages add constraint messages_content_shape_check check (
  (message_type = 'text' and image_path is null and offer_amount_grosz is null and offer_status is null)
  or (message_type = 'image' and image_path is not null and offer_amount_grosz is null and offer_status is null)
  or (message_type = 'price_offer' and image_path is null and offer_amount_grosz is not null and offer_status is not null)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('message-images', 'message-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "participants read message images" on storage.objects;
create policy "participants read message images" on storage.objects for select to authenticated using (
  bucket_id = 'message-images'
  and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
drop policy if exists "participants upload message images" on storage.objects;
create policy "participants upload message images" on storage.objects for insert to authenticated with check (
  bucket_id = 'message-images'
  and (storage.foldername(name))[2] = auth.uid()::text
  and exists (
    select 1 from public.conversation_participants p
    where p.conversation_id::text = (storage.foldername(name))[1]
      and p.user_id = auth.uid()
  )
);
drop policy if exists "senders delete message images" on storage.objects;
create policy "senders delete message images" on storage.objects for delete to authenticated using (
  bucket_id = 'message-images' and (storage.foldername(name))[2] = auth.uid()::text
);

create or replace function public.send_price_offer(p_conversation_id uuid, p_amount_grosz integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  conv public.conversations%rowtype;
  item public.listings%rowtype;
  offer_id uuid;
begin
  select * into conv from public.conversations where id = p_conversation_id;
  if not found or conv.buyer_id is distinct from auth.uid() then raise exception 'Only buyer can make an offer'; end if;
  select * into item from public.listings where id = conv.listing_id for update;
  if not found or item.status <> 'active' then raise exception 'Listing unavailable'; end if;
  if p_amount_grosz < 100 or p_amount_grosz >= item.price_grosz then raise exception 'Offer must be lower than listing price'; end if;
  update public.messages set offer_status = 'rejected'
    where conversation_id = p_conversation_id and message_type = 'price_offer' and offer_status = 'pending';
  insert into public.messages(conversation_id, sender_id, body, message_type, offer_amount_grosz, offer_status)
    values(p_conversation_id, auth.uid(), 'Propozycja ceny', 'price_offer', p_amount_grosz, 'pending')
    returning id into offer_id;
  return offer_id;
end;
$$;

create or replace function public.respond_to_price_offer(p_message_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  offer public.messages%rowtype;
  seller_id uuid;
begin
  select * into offer from public.messages where id = p_message_id for update;
  if not found or offer.message_type <> 'price_offer' or offer.offer_status <> 'pending' then
    raise exception 'Offer unavailable';
  end if;
  select l.seller_id into seller_id from public.conversations c
    join public.listings l on l.id = c.listing_id where c.id = offer.conversation_id;
  if seller_id is distinct from auth.uid() then raise exception 'Only seller can respond'; end if;
  update public.messages set offer_status = case when p_accept then 'accepted' else 'rejected' end
    where id = p_message_id;
end;
$$;

revoke all on function public.send_price_offer(uuid, integer) from public, anon;
revoke all on function public.respond_to_price_offer(uuid, boolean) from public, anon;
grant execute on function public.send_price_offer(uuid, integer) to authenticated;
grant execute on function public.respond_to_price_offer(uuid, boolean) to authenticated;

commit;
