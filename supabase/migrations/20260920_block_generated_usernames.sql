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
    and lower(trim(candidate)) !~ '^user_[a-f0-9]{8}$'
    and not exists (
      select 1
      from public.profiles
      where lower(username) = lower(trim(candidate))
    );
$$;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_username text := nullif(trim(new.raw_user_meta_data->>'username'), '');
begin
  if requested_username is null then
    return new;
  end if;

  if requested_username !~ '^[a-zA-Z0-9_.-]{3,40}$'
     or lower(requested_username) ~ '^user_[a-f0-9]{8}$' then
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
