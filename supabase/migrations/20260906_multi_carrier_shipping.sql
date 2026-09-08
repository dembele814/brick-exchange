-- Every order stores the carrier selected by the buyer. `locker_id` remains
-- the generic pickup-point code for backwards compatibility with InPost.
alter table public.orders
  add column if not exists shipping_carrier text not null default 'inpost'
    check (shipping_carrier in ('inpost', 'orlen', 'dpd', 'dhl'));

alter table public.orders
  add column if not exists shipping_service text not null default 'pickup_point';
