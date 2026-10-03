-- OAuth credentials are server-only. RLS intentionally has no client policies.
create table if not exists public.shipping_provider_accounts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('furgonetka')),
  access_token_encrypted text not null,
  refresh_token_encrypted text not null,
  access_token_expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.shipping_provider_accounts enable row level security;

alter table public.private_profiles
  add column if not exists shipping_street text,
  add column if not exists shipping_postcode text,
  add column if not exists shipping_city text;

