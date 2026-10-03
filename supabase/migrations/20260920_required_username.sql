create unique index if not exists profiles_username_case_insensitive_unique
  on public.profiles (lower(username));

create or replace function public.username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    candidate is not null
    and trim(candidate) ~ '^[a-zA-Z0-9_.-]{3,40}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(candidate))
    );
$$;

revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

drop policy if exists "own profile insert" on public.profiles;
create policy "own profile insert"
  on public.profiles
  for insert
  to authenticated
  with check (id = auth.uid());

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text := nullif(trim(new.raw_user_meta_data->>'username'), '');
begin
  -- OAuth creates the Auth user first. Its profile is inserted only after the
  -- person explicitly chooses an available username on the registration page.
  if requested_username is null then
    return new;
  end if;

  if requested_username !~ '^[a-zA-Z0-9_.-]{3,40}$' then
    raise exception 'invalid_username' using errcode = 'check_violation';
  end if;

  insert into public.profiles (id, username, bio, country, city, language)
  values (
    new.id,
    requested_username,
    nullif(trim(new.raw_user_meta_data->>'bio'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'country'), ''), 'Nie ustawiono'),
    nullif(trim(new.raw_user_meta_data->>'city'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'language'), ''), 'Nie ustawiono')
  );
  return new;
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = 'unique_violation';
end;
$$;
