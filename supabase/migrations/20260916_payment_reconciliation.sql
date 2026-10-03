alter table public.orders
  add column if not exists seller_transfer_id text,
  add column if not exists seller_transfer_status text
    check (seller_transfer_status in ('paid', 'reversed')),
  add column if not exists seller_transferred_at timestamptz,
  add column if not exists reconciliation_attempted_at timestamptz;

create unique index if not exists orders_seller_transfer_unique
  on public.orders(seller_transfer_id)
  where seller_transfer_id is not null;

create table if not exists public.reconciliation_runs (
  id bigint generated always as identity primary key,
  mode text not null check (mode in ('test', 'live')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  pending_payments_checked integer not null default 0,
  refunds_completed integer not null default 0,
  transfers_completed integer not null default 0,
  failures integer not null default 0
);

alter table public.reconciliation_runs enable row level security;
