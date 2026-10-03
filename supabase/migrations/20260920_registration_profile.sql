create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, bio, country, city, language)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), 'user_' || substr(new.id::text, 1, 8)),
    nullif(trim(new.raw_user_meta_data->>'bio'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'country'), ''), 'Nie ustawiono'),
    nullif(trim(new.raw_user_meta_data->>'city'), ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'language'), ''), 'Nie ustawiono')
  );
  return new;
end;
$$;
