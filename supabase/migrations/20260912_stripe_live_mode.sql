begin;

alter table public.orders
  add column if not exists stripe_livemode boolean not null default false;

create or replace function public.reserve_stripe_checkout(
  p_buyer_id uuid, p_listing_id uuid, p_carrier text, p_locker_id text,
  p_receiver jsonb, p_origin text, p_offer_message_id uuid, p_stripe_livemode boolean
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item public.listings%rowtype;
  purchase public.orders%rowtype;
  accepted_offer public.messages%rowtype;
  checkout_amount integer;
begin
  if p_stripe_livemode is null then raise exception 'Stripe mode required'; end if;
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
      where m.id = p_offer_message_id and m.message_type = 'price_offer'
        and m.offer_status = 'accepted' and c.listing_id = p_listing_id
        and c.buyer_id = p_buyer_id and m.sender_id in (p_buyer_id, item.seller_id);
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
      or purchase.accepted_offer_id is distinct from p_offer_message_id
      or purchase.stripe_livemode is distinct from p_stripe_livemode
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
    listing_id, buyer_id, seller_id, amount_grosz, accepted_offer_id, stripe_livemode,
    shipping_carrier, shipping_service, locker_id, receiver_email, receiver_phone,
    receiver_first_name, receiver_last_name, checkout_title, checkout_origin, checkout_expires_at
  ) values (
    item.id, p_buyer_id, item.seller_id, checkout_amount, p_offer_message_id, p_stripe_livemode,
    p_carrier, 'pickup_point', p_locker_id, p_receiver->>'email', p_receiver->>'phone',
    p_receiver->>'firstName', p_receiver->>'lastName', item.title, p_origin,
    floor(extract(epoch from now()))::bigint + 3600
  ) returning * into purchase;
  return to_jsonb(purchase);
end;
$$;

create or replace function public.apply_stripe_checkout_event(
  p_event_id text, p_event_type text, p_order_id uuid, p_session_id text,
  p_amount integer, p_currency text, p_buyer_id text, p_integration text,
  p_payment_intent_id text, p_paid boolean, p_stripe_livemode boolean
) returns void language plpgsql security definer set search_path = public as $$
declare purchase public.orders%rowtype; item_id uuid;
begin
  select listing_id into item_id from public.orders where id = p_order_id;
  if not found then raise exception 'Unknown order'; end if;
  perform 1 from public.listings where id = item_id for update;
  select * into purchase from public.orders where id = p_order_id for update;
  if p_event_id is null or p_session_id is null or p_session_id not like 'cs_%'
    or p_amount is distinct from purchase.amount_grosz or p_currency is distinct from 'pln'
    or p_paid is null or p_stripe_livemode is distinct from purchase.stripe_livemode then
    raise exception 'Invalid payment details';
  end if;
  if p_paid and p_event_type not in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
    or not p_paid and p_event_type not in ('checkout.session.expired', 'checkout.session.async_payment_failed') then
    raise exception 'Invalid event transition';
  end if;
  if purchase.stripe_checkout_session_id is not null then
    if purchase.stripe_checkout_session_id <> p_session_id then raise exception 'Session mismatch'; end if;
  elsif purchase.checkout_title is null or p_integration is distinct from 'klockownia_checkout_v1'
    or p_buyer_id is distinct from purchase.buyer_id::text then
    raise exception 'Unbound session cannot fulfill this order';
  end if;
  if purchase.checkout_title is not null and
    (p_buyer_id is distinct from purchase.buyer_id::text or p_integration is distinct from 'klockownia_checkout_v1') then
    raise exception 'Order identity mismatch';
  end if;
  insert into public.stripe_checkout_events(event_id, event_type, order_id, session_id)
    values(p_event_id, p_event_type, p_order_id, p_session_id) on conflict do nothing;
  if not found then return; end if;
  if p_paid then
    if purchase.payment_status in ('paid', 'refunded') then return; end if;
    if purchase.status <> 'pending_payment' or purchase.payment_status <> 'pending' then
      raise exception 'Payment arrived for a closed order';
    end if;
    update public.orders set payment_status = 'paid', status = 'paid',
      stripe_checkout_session_id = p_session_id, stripe_payment_intent_id = p_payment_intent_id,
      updated_at = now() where id = p_order_id;
    update public.listings set status = 'sold', updated_at = now() where id = purchase.listing_id;
    insert into public.order_events(order_id, event_type, payload) values(p_order_id, 'payment_confirmed',
      jsonb_build_object('stripe_event_id', p_event_id, 'stripe_checkout_session_id', p_session_id,
        'stripe_livemode', p_stripe_livemode));
    insert into public.notifications(user_id, kind, title, body, href) values
      (purchase.buyer_id, 'payment', 'Płatność potwierdzona', 'Twoje zamówienie zostało opłacone. Czekaj na nadanie przesyłki.', '/zamowienia?order=' || p_order_id),
      (purchase.seller_id, 'payment', 'Masz opłacone zamówienie', 'Kupujący opłacił ofertę. Przygotuj i nadaj przesyłkę.', '/zamowienia?order=' || p_order_id);
  elsif purchase.status = 'pending_payment' and purchase.payment_status = 'pending' then
    update public.orders set payment_status = 'failed', status = 'cancelled',
      stripe_checkout_session_id = p_session_id, updated_at = now() where id = p_order_id;
    insert into public.order_events(order_id, event_type, payload) values(p_order_id, 'payment_cancelled',
      jsonb_build_object('stripe_event_id', p_event_id, 'reason', p_event_type,
        'stripe_livemode', p_stripe_livemode));
  end if;
end;
$$;

revoke all on function public.reserve_stripe_checkout(uuid,uuid,text,text,jsonb,text,uuid,boolean)
  from public, anon, authenticated;
revoke all on function public.apply_stripe_checkout_event(text,text,uuid,text,integer,text,text,text,text,boolean,boolean)
  from public, anon, authenticated;
grant execute on function public.reserve_stripe_checkout(uuid,uuid,text,text,jsonb,text,uuid,boolean)
  to service_role;
grant execute on function public.apply_stripe_checkout_event(text,text,uuid,text,integer,text,text,text,text,boolean,boolean)
  to service_role;

commit;
