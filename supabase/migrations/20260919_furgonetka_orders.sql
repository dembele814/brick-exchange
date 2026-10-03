alter table public.orders
  add column if not exists shipping_provider text
    check (shipping_provider in ('inpost_shipx', 'furgonetka')),
  add column if not exists shipping_price_grosz integer
    check (shipping_price_grosz is null or shipping_price_grosz > 0),
  add column if not exists carrier_order_command_id text;

create unique index if not exists orders_carrier_order_command_unique
  on public.orders(shipping_provider, carrier_order_command_id)
  where carrier_order_command_id is not null;
