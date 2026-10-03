begin;

create table if not exists public.account_moderation (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'suspended', 'permanent')),
  suspended_until timestamptz,
  reason text check (reason is null or char_length(reason) <= 500),
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status = 'active' and suspended_until is null) or
    (status = 'suspended' and suspended_until is not null) or
    (status = 'permanent' and suspended_until is null)
  )
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null,
  action text not null check (char_length(action) between 2 and 80),
  target_type text not null check (target_type in ('user', 'listing', 'order', 'report', 'system')),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);

alter table public.account_moderation enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.account_moderation from anon, authenticated;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public.account_can_act(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.account_moderation moderation
    where moderation.user_id = p_user_id
      and (
        moderation.status = 'permanent' or
        (moderation.status = 'suspended' and moderation.suspended_until > now())
      )
  );
$$;

revoke all on function public.account_can_act(uuid) from public, anon;
grant execute on function public.account_can_act(uuid) to authenticated, service_role;

drop policy if exists "seller creates listing" on public.listings;
create policy "seller creates listing" on public.listings for insert
  with check (seller_id = auth.uid() and public.account_can_act(auth.uid()));

drop policy if exists "seller changes listing" on public.listings;
create policy "seller changes listing" on public.listings for update
  using (seller_id = auth.uid() and public.account_can_act(auth.uid()))
  with check (seller_id = auth.uid() and public.account_can_act(auth.uid()));

drop policy if exists "participants send messages" on public.messages;
create policy "participants send messages" on public.messages for insert
  with check (
    sender_id = auth.uid() and public.account_can_act(auth.uid()) and
    exists (
      select 1 from public.conversation_participants participant
      where participant.conversation_id = conversation_id and participant.user_id = auth.uid()
    )
  );

commit;
