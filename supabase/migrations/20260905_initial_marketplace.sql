create extension if not exists pgcrypto;

create type public.listing_status as enum ('draft','active','hidden','sold','archived');
create type public.order_status as enum ('pending_payment','paid','shipped','delivered','cancelled','refunded');
create type public.payment_status as enum ('pending','paid','failed','refunded');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_.-]{3,40}$'),
  avatar_path text, bio text check (char_length(bio) <= 500), country text not null default 'Polska',
  city text, language text not null default 'pl', profile_visible boolean not null default true,
  vacation_mode boolean not null default false, show_city boolean not null default true,
  personalised_ads boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.private_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  full_name text, phone text, birth_date date, updated_at timestamptz not null default now()
);
create table public.listings (
  id uuid primary key default gen_random_uuid(), seller_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 3 and 80), description text not null default '' check (char_length(description) <= 1500),
  category text not null, theme text not null, set_number text, condition text not null, price_grosz integer not null check (price_grosz > 0),
  pieces integer, production_year integer, is_complete boolean not null default false, has_instructions boolean not null default false,
  has_box boolean not null default false, status public.listing_status not null default 'draft', promoted_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.listing_images (
  id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id) on delete cascade,
  storage_path text not null unique, position smallint not null check (position between 0 and 19), created_at timestamptz not null default now(), unique(listing_id, position)
);
create table public.favorites (user_id uuid references public.profiles(id) on delete cascade, listing_id uuid references public.listings(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,listing_id));
create table public.conversations (id uuid primary key default gen_random_uuid(), listing_id uuid not null references public.listings(id), created_at timestamptz not null default now(), unique(listing_id));
create table public.conversation_participants (conversation_id uuid references public.conversations(id) on delete cascade, user_id uuid references public.profiles(id) on delete cascade, last_read_at timestamptz, primary key(conversation_id,user_id));
create table public.messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade, sender_id uuid not null references public.profiles(id), body text not null check(char_length(body) between 1 and 2000), created_at timestamptz not null default now());
create table public.orders (id uuid primary key default gen_random_uuid(), listing_id uuid not null unique references public.listings(id), buyer_id uuid not null references public.profiles(id), seller_id uuid not null references public.profiles(id), amount_grosz integer not null check(amount_grosz > 0), status public.order_status not null default 'pending_payment', payment_status public.payment_status not null default 'pending', stripe_checkout_session_id text unique, inpost_shipment_id text unique, locker_id text not null, receiver_email text not null, receiver_phone text not null, receiver_first_name text not null, receiver_last_name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.order_events (id bigint generated always as identity primary key, order_id uuid not null references public.orders(id) on delete cascade, actor_id uuid references public.profiles(id), event_type text not null, payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

create or replace function public.create_profile_for_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, username) values (new.id, coalesce(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text,1,8))); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.create_profile_for_new_user();

alter table public.profiles enable row level security; alter table public.private_profiles enable row level security; alter table public.listings enable row level security; alter table public.listing_images enable row level security; alter table public.favorites enable row level security; alter table public.conversations enable row level security; alter table public.conversation_participants enable row level security; alter table public.messages enable row level security; alter table public.orders enable row level security; alter table public.order_events enable row level security;
create policy "public profiles" on public.profiles for select using (profile_visible or id = auth.uid());
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "own private profile" on public.private_profiles for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "active listings public" on public.listings for select using (status = 'active' or seller_id = auth.uid());
create policy "seller creates listing" on public.listings for insert with check (seller_id = auth.uid());
create policy "seller changes listing" on public.listings for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());
create policy "listing images readable" on public.listing_images for select using (exists(select 1 from public.listings l where l.id = listing_id and (l.status = 'active' or l.seller_id = auth.uid())));
create policy "seller manages images" on public.listing_images for all using (exists(select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid())) with check (exists(select 1 from public.listings l where l.id = listing_id and l.seller_id = auth.uid()));
create policy "own favorites" on public.favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "participants read conversations" on public.conversations for select using (exists(select 1 from public.conversation_participants p where p.conversation_id = id and p.user_id = auth.uid()));
create policy "participants read messages" on public.messages for select using (exists(select 1 from public.conversation_participants p where p.conversation_id = messages.conversation_id and p.user_id = auth.uid()));
create policy "participants send messages" on public.messages for insert with check (sender_id = auth.uid() and exists(select 1 from public.conversation_participants p where p.conversation_id = conversation_id and p.user_id = auth.uid()));
create policy "order parties read" on public.orders for select using (buyer_id = auth.uid() or seller_id = auth.uid());
create policy "order parties read events" on public.order_events for select using (exists(select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
