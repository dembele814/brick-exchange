begin;

create or replace function public.send_price_offer(p_conversation_id uuid, p_amount_grosz integer)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  conv public.conversations%rowtype;
  item public.listings%rowtype;
  offer_id uuid;
begin
  select * into conv from public.conversations where id = p_conversation_id;
  if not found or not exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation_id and p.user_id = auth.uid()
  ) then raise exception 'Conversation unavailable'; end if;
  select * into item from public.listings where id = conv.listing_id for update;
  if not found or item.status <> 'active' then raise exception 'Listing unavailable'; end if;
  if auth.uid() <> conv.buyer_id and auth.uid() <> item.seller_id then
    raise exception 'Only buyer or seller can make an offer';
  end if;
  if p_amount_grosz < 100 or p_amount_grosz >= item.price_grosz then
    raise exception 'Offer must be lower than listing price';
  end if;
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
begin
  select * into offer from public.messages where id = p_message_id for update;
  if not found or offer.message_type <> 'price_offer' or offer.offer_status <> 'pending'
    or offer.sender_id = auth.uid() or not exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = offer.conversation_id and p.user_id = auth.uid()
    ) then raise exception 'Offer unavailable'; end if;
  update public.messages set offer_status = case when p_accept then 'accepted' else 'rejected' end
    where id = p_message_id;
end;
$$;

create or replace function public.reserve_stripe_checkout(
  p_buyer_id uuid, p_listing_id uuid, p_carrier text, p_locker_id text,
  p_receiver jsonb, p_origin text, p_offer_message_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item public.listings%rowtype;
  purchase public.orders%rowtype;
  accepted_offer public.messages%rowtype;
  checkout_amount integer;
begin
  select * into item from public.listings where id = p_listing_id for update;
  if not found or item.status <> 'active' or item.seller_id = p_buyer_id then
    raise exception 'Listing unavailable';
  end if;
  if exists(select 1 from public.profiles where id = item.seller_id and vacation_mode) then
    raise exception 'Seller unavailable';
  end if;

  checkout_amount := item.price_grosz;
  if p_offer_message_id is not null then
    select m.* into accepted_offer
      from public.messages m join public.conversations c on c.id = m.conversation_id
      where m.id = p_offer_message_id
        and m.message_type = 'price_offer' and m.offer_status = 'accepted'
        and c.listing_id = p_listing_id and c.buyer_id = p_buyer_id
        and m.sender_id in (p_buyer_id, item.seller_id);
    if not found or accepted_offer.offer_amount_grosz is null
      or accepted_offer.offer_amount_grosz >= item.price_grosz then
      raise exception 'Accepted offer unavailable';
    end if;
    checkout_amount := accepted_offer.offer_amount_grosz;
  end if;

  select * into purchase from public.orders
    where listing_id = p_listing_id and status <> 'cancelled' for update;
  if found then
    if purchase.buyer_id <> p_buyer_id or purchase.status <> 'pending_payment'
      or purchase.payment_status <> 'pending' or purchase.checkout_title is null
      or purchase.checkout_origin is null or purchase.checkout_expires_at is null
      or purchase.amount_grosz is distinct from checkout_amount
      or purchase.accepted_offer_id is distinct from p_offer_message_id
      or purchase.shipping_carrier is distinct from p_carrier
      or purchase.locker_id is distinct from p_locker_id
      or purchase.receiver_email is distinct from p_receiver->>'email'
      or purchase.receiver_phone is distinct from p_receiver->>'phone'
      or purchase.receiver_first_name is distinct from p_receiver->>'firstName'
      or purchase.receiver_last_name is distinct from p_receiver->>'lastName' then
      raise exception 'Listing reserved or previous checkout requires reconciliation';
    end if;
    return to_jsonb(purchase);
  end if;

  insert into public.orders (
    listing_id, buyer_id, seller_id, amount_grosz, accepted_offer_id,
    shipping_carrier, shipping_service, locker_id, receiver_email, receiver_phone,
    receiver_first_name, receiver_last_name, checkout_title, checkout_origin, checkout_expires_at
  ) values (
    item.id, p_buyer_id, item.seller_id, checkout_amount, p_offer_message_id,
    p_carrier, 'pickup_point', p_locker_id, p_receiver->>'email', p_receiver->>'phone',
    p_receiver->>'firstName', p_receiver->>'lastName', item.title, p_origin,
    floor(extract(epoch from now()))::bigint + 3600
  ) returning * into purchase;
  return to_jsonb(purchase);
end;
$$;

commit;
