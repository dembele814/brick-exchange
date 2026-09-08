-- Apply after the existing marketplace, shipping, and notifications migrations.
-- Pause Checkout and reconcile any existing live sessions before deploying this
-- test-only application version. This migration never deletes historical orders.
begin;

alter table public.orders
  add column if not exists checkout_title text,
  add column if not exists checkout_origin text,
  add column if not exists checkout_expires_at bigint,
  add column if not exists stripe_payment_intent_id text;

alter table public.orders drop constraint if exists orders_listing_id_key;
create unique index if not exists orders_reserved_listing_idx on public.orders(listing_id)
  where status <> 'cancelled';

create table if not exists public.stripe_checkout_events (
  event_id text primary key,
  event_type text not null,
  order_id uuid not null references public.orders(id),
  session_id text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_checkout_events enable row level security;
revoke all on public.stripe_checkout_events from anon, authenticated;

create or replace function public.reserve_stripe_checkout(
  p_buyer_id uuid, p_listing_id uuid, p_carrier text, p_locker_id text,
  p_receiver jsonb, p_origin text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  item public.listings%rowtype;
  purchase public.orders%rowtype;
begin
  -- Same lock order as fulfillment: listing first, then order.
  select * into item from public.listings where id = p_listing_id for update;
  if not found or item.status <> 'active' or item.seller_id = p_buyer_id then
    raise exception 'Listing unavailable';
  end if;
  if exists(select 1 from public.profiles where id = item.seller_id and vacation_mode) then
    raise exception 'Seller unavailable';
  end if;
  select * into purchase from public.orders
    where listing_id = p_listing_id and status <> 'cancelled' for update;
  if found then
    if purchase.buyer_id <> p_buyer_id or purchase.status <> 'pending_payment'
      or purchase.payment_status <> 'pending' or purchase.checkout_title is null
      or purchase.checkout_origin is null or purchase.checkout_expires_at is null
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
    listing_id, buyer_id, seller_id, amount_grosz, shipping_carrier, shipping_service,
    locker_id, receiver_email, receiver_phone, receiver_first_name, receiver_last_name,
    checkout_title, checkout_origin, checkout_expires_at
  ) values (
    item.id, p_buyer_id, item.seller_id, item.price_grosz, p_carrier, 'pickup_point',
    p_locker_id, p_receiver->>'email', p_receiver->>'phone', p_receiver->>'firstName', p_receiver->>'lastName',
    item.title, p_origin, floor(extract(epoch from now()))::bigint + 3600
  ) returning * into purchase;
  return to_jsonb(purchase);
end;
$$;

create or replace function public.bind_stripe_checkout(p_order_id uuid, p_session_id text)
returns void language plpgsql security definer set search_path = public as $$
declare purchase public.orders%rowtype;
begin
  select * into purchase from public.orders where id = p_order_id for update;
  if not found or p_session_id is null or p_session_id not like 'cs_%' then
    raise exception 'Invalid checkout binding';
  end if;
  if purchase.stripe_checkout_session_id is not null then
    if purchase.stripe_checkout_session_id <> p_session_id then raise exception 'Session mismatch'; end if;
    return;
  end if;
  if purchase.status <> 'pending_payment' or purchase.payment_status <> 'pending' then
    raise exception 'Order no longer pending';
  end if;
  update public.orders set stripe_checkout_session_id = p_session_id, updated_at = now() where id = p_order_id;
  insert into public.order_events(order_id, actor_id, event_type, payload)
    values(p_order_id, purchase.buyer_id, 'checkout_started', jsonb_build_object('stripe_checkout_session_id', p_session_id));
end;
$$;

create or replace function public.apply_stripe_checkout_event(
  p_event_id text, p_event_type text, p_order_id uuid, p_session_id text,
  p_amount integer, p_currency text, p_buyer_id text, p_integration text,
  p_payment_intent_id text, p_paid boolean
) returns void language plpgsql security definer set search_path = public as $$
declare
  purchase public.orders%rowtype;
  item_id uuid;
begin
  select listing_id into item_id from public.orders where id = p_order_id;
  if not found then raise exception 'Unknown order'; end if;
  perform 1 from public.listings where id = item_id for update;
  select * into purchase from public.orders where id = p_order_id for update;
  if p_event_id is null or p_session_id is null or p_session_id not like 'cs_%'
    or p_amount is distinct from purchase.amount_grosz or p_currency is distinct from 'pln'
    or p_paid is null then raise exception 'Invalid payment details'; end if;
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
    if purchase.payment_status = 'paid' or purchase.payment_status = 'refunded' then return; end if;
    -- A late success after cancellation requires operator reconciliation, never
    -- fulfillment of a second order for an already released listing.
    if purchase.status <> 'pending_payment' or purchase.payment_status <> 'pending' then
      raise exception 'Payment arrived for a closed order';
    end if;
    update public.orders set payment_status = 'paid', status = 'paid',
      stripe_checkout_session_id = p_session_id, stripe_payment_intent_id = p_payment_intent_id,
      updated_at = now() where id = p_order_id;
    update public.listings set status = 'sold', updated_at = now() where id = purchase.listing_id;
    insert into public.order_events(order_id, event_type, payload) values(p_order_id, 'payment_confirmed',
      jsonb_build_object('stripe_event_id', p_event_id, 'stripe_checkout_session_id', p_session_id));
    insert into public.notifications(user_id, kind, title, body, href) values
      (purchase.buyer_id, 'payment', 'Płatność potwierdzona', 'Twoje zamówienie zostało opłacone. Czekaj na nadanie przesyłki.', '/zamowienia?order=' || p_order_id),
      (purchase.seller_id, 'payment', 'Masz opłacone zamówienie', 'Kupujący opłacił ofertę. Przygotuj i nadaj przesyłkę.', '/zamowienia?order=' || p_order_id);
  elsif purchase.status = 'pending_payment' and purchase.payment_status = 'pending' then
    update public.orders set payment_status = 'failed', status = 'cancelled',
      stripe_checkout_session_id = p_session_id, updated_at = now() where id = p_order_id;
    insert into public.order_events(order_id, event_type, payload) values(p_order_id, 'payment_cancelled',
      jsonb_build_object('stripe_event_id', p_event_id, 'reason', p_event_type));
  end if;
end;
$$;

-- SECURITY DEFINER RPCs must never be callable with a browser key or user JWT.
revoke all on function public.reserve_stripe_checkout(uuid, uuid, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.bind_stripe_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.apply_stripe_checkout_event(text, text, uuid, text, integer, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.reserve_stripe_checkout(uuid, uuid, text, text, jsonb, text) to service_role;
grant execute on function public.bind_stripe_checkout(uuid, text) to service_role;
grant execute on function public.apply_stripe_checkout_event(text, text, uuid, text, integer, text, text, text, text, boolean) to service_role;

commit;
