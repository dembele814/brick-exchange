-- Carrier-agnostic fulfillment data. It supports a generated carrier label
-- later, but also lets the seller provide a valid tracking number today.
alter table public.orders
  add column if not exists tracking_number text check (char_length(tracking_number) between 3 and 100),
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;
