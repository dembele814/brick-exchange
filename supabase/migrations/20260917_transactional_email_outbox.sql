create table if not exists public.email_outbox (
  id bigint generated always as identity primary key,
  notification_id bigint not null unique references public.notifications(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  subject text not null check (char_length(subject) <= 140),
  body text not null check (char_length(body) <= 500),
  href text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  lock_token uuid,
  provider_message_id text unique,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists email_outbox_pending_idx
  on public.email_outbox(next_attempt_at, id)
  where status in ('pending', 'processing');

alter table public.email_outbox enable row level security;

create or replace function public.queue_notification_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind in ('payment', 'shipment', 'delivery', 'system') then
    insert into public.email_outbox(notification_id, user_id, kind, subject, body, href)
      values(new.id, new.user_id, new.kind, new.title, new.body, new.href)
      on conflict (notification_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_queue_transactional_email on public.notifications;
create trigger notifications_queue_transactional_email
  after insert on public.notifications
  for each row execute function public.queue_notification_email();

create or replace function public.claim_email_outbox(p_limit integer, p_lock_token uuid)
returns setof public.email_outbox
language plpgsql security definer set search_path = '' as $$
begin
  if p_limit < 1 or p_limit > 100 then raise exception 'Invalid email batch size'; end if;
  return query
    update public.email_outbox as outbox
    set status = 'processing', attempt_count = outbox.attempt_count + 1,
        locked_until = now() + interval '5 minutes', lock_token = p_lock_token, updated_at = now()
    where outbox.id in (
      select candidate.id from public.email_outbox as candidate
      where candidate.next_attempt_at <= now()
        and (candidate.status = 'pending' or (candidate.status = 'processing' and candidate.locked_until < now()))
      order by candidate.next_attempt_at, candidate.id for update skip locked limit p_limit
    )
    returning outbox.*;
end;
$$;

revoke all on table public.email_outbox from anon, authenticated;
revoke all on function public.queue_notification_email() from public, anon, authenticated;
revoke all on function public.claim_email_outbox(integer, uuid) from public, anon, authenticated;
grant execute on function public.claim_email_outbox(integer, uuid) to service_role;
