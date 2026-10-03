alter table public.listings
  add column if not exists parcel_template text not null default 'small'
    check (parcel_template in ('small', 'medium', 'large'));

alter table public.orders
  add column if not exists parcel_template text not null default 'small'
    check (parcel_template in ('small', 'medium', 'large')),
  add column if not exists carrier_shipment_id text,
  add column if not exists carrier_status text,
  add column if not exists carrier_status_updated_at timestamptz,
  add column if not exists shipping_label_ready_at timestamptz,
  add column if not exists shipping_creation_started_at timestamptz,
  add column if not exists shipping_livemode boolean;

create unique index if not exists orders_carrier_shipment_unique
  on public.orders(shipping_carrier, carrier_shipment_id)
  where carrier_shipment_id is not null;

create unique index if not exists orders_tracking_number_unique
  on public.orders(shipping_carrier, tracking_number)
  where tracking_number is not null;

create table if not exists public.shipping_webhook_events (
  provider text not null,
  event_id text not null,
  received_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.shipping_webhook_events enable row level security;

create or replace function public.copy_listing_parcel_template()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select parcel_template into new.parcel_template
  from public.listings where id = new.listing_id;
  return new;
end;
$$;

drop trigger if exists orders_copy_listing_parcel_template on public.orders;
create trigger orders_copy_listing_parcel_template
before insert on public.orders for each row
execute function public.copy_listing_parcel_template();
