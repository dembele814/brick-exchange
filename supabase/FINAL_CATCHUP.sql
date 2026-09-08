-- Klockownia: safe final database catch-up.
-- It can be run more than once in the Supabase SQL Editor.

alter table public.orders
  add column if not exists shipping_carrier text not null default 'inpost'
    check (shipping_carrier in ('inpost', 'orlen', 'dpd', 'dhl')),
  add column if not exists shipping_service text not null default 'pickup_point',
  add column if not exists tracking_number text check (char_length(tracking_number) between 3 and 100),
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz;

drop policy if exists "seller deletes own listing" on public.listings;
create policy "seller deletes own listing" on public.listings
  for delete using (seller_id = auth.uid());

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (char_length(body) <= 500),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
drop policy if exists "reviews are public" on public.reviews;
create policy "reviews are public" on public.reviews for select using (true);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('misleading', 'counterfeit', 'prohibited', 'spam', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);
alter table public.listing_reports enable row level security;

create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('payment', 'shipment', 'delivery', 'review', 'system')),
  title text not null check (char_length(title) <= 140),
  body text not null check (char_length(body) <= 500),
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications for select using (user_id = auth.uid());
drop policy if exists "users mark own notifications read" on public.notifications;
create policy "users mark own notifications read" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.conversation_participants;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;
