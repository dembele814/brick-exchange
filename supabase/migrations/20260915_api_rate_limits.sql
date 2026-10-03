create table if not exists public.api_rate_limits (
  scope text not null,
  key_hash text not null,
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (scope, key_hash)
);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_window timestamptz;
  current_requests integer;
begin
  if char_length(p_scope) not between 1 and 80
    or p_key_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 10000
    or p_window_seconds not between 1 and 86400 then
    raise exception 'invalid rate limit configuration';
  end if;

  current_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.api_rate_limits(scope, key_hash, window_start, requests)
  values (p_scope, p_key_hash, current_window, 1)
  on conflict (scope, key_hash) do update set
    window_start = case
      when api_rate_limits.window_start < excluded.window_start then excluded.window_start
      else api_rate_limits.window_start
    end,
    requests = case
      when api_rate_limits.window_start < excluded.window_start then 1
      else api_rate_limits.requests + 1
    end
  returning requests into current_requests;

  return current_requests <= p_limit;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer)
  to service_role;
