-- 0014 — Platform Control can suspend shops; members cannot reverse it.

create or replace function public.guard_shop_suspension_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.is_suspended or new.suspension_reason is not null then
      if pg_catalog.current_setting('qassa.allow_shop_suspension', true)
        is distinct from 'on'
      then
        raise exception 'Shop suspension can only be changed by platform administration.'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if new.is_suspended is distinct from old.is_suspended
    or new.suspension_reason is distinct from old.suspension_reason
  then
    if pg_catalog.current_setting('qassa.allow_shop_suspension', true)
      is distinct from 'on'
    then
      raise exception 'Shop suspension can only be changed by platform administration.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists barbershops_suspension_guard on public.barbershops;
create trigger barbershops_suspension_guard
  before insert or update of is_suspended, suspension_reason on public.barbershops
  for each row execute function public.guard_shop_suspension_changes();

create or replace function public.list_platform_shops()
returns table (
  id uuid,
  name text,
  slug text,
  city text,
  is_published boolean,
  is_suspended boolean,
  suspension_reason text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access required.'
      using errcode = '42501';
  end if;

  return query
    select
      shop.id,
      shop.name,
      shop.slug,
      shop.city,
      shop.is_published,
      shop.is_suspended,
      shop.suspension_reason,
      shop.created_at
    from public.barbershops shop
    order by shop.created_at desc, shop.name
    limit 100;
end;
$$;

revoke execute on function public.list_platform_shops()
  from public, anon;
grant execute on function public.list_platform_shops()
  to authenticated;

create or replace function public.set_shop_suspension(
  p_shop_id uuid,
  p_is_suspended boolean,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if p_shop_id is null or p_is_suspended is null then
    raise exception 'A valid suspension request is required.'
      using errcode = '22023';
  end if;
  if p_reason is not null and char_length(btrim(p_reason)) > 250 then
    raise exception 'Suspension reason is too long.'
      using errcode = '22023';
  end if;

  select admin.role into v_role
  from public.platform_admins admin
  where admin.user_id = auth.uid()
    and admin.is_active;

  if v_role is null
    or v_role not in ('platform_owner', 'super_admin', 'operations_admin')
  then
    raise exception 'Shop suspension requires an operations administrator.'
      using errcode = '42501';
  end if;

  perform pg_catalog.set_config('qassa.allow_shop_suspension', 'on', true);

  update public.barbershops
  set is_suspended = p_is_suspended,
      suspension_reason = case
        when p_is_suspended then nullif(btrim(p_reason), '')
        else null
      end
  where id = p_shop_id;

  return found;
end;
$$;

revoke execute on function public.set_shop_suspension(uuid, boolean, text)
  from public, anon;
grant execute on function public.set_shop_suspension(uuid, boolean, text)
  to authenticated;
