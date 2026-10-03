begin;

alter table public.listings
  add column if not exists seller_is_private boolean not null default false;

create or replace function public.enforce_private_marketplace_sale()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'active' and not new.seller_is_private then
    raise exception 'Private seller declaration required';
  end if;
  return new;
end;
$$;

drop trigger if exists require_private_seller_for_active_listing on public.listings;
create trigger require_private_seller_for_active_listing
  before insert or update of status, seller_is_private on public.listings
  for each row execute function public.enforce_private_marketplace_sale();

create or replace function public.enforce_private_seller_order()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (
    select 1 from public.listings
    where id = new.listing_id and seller_is_private
  ) then raise exception 'Private seller declaration required'; end if;
  return new;
end;
$$;

drop trigger if exists require_private_seller_for_order on public.orders;
create trigger require_private_seller_for_order
  before insert on public.orders
  for each row execute function public.enforce_private_seller_order();

commit;
