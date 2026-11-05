-- 0010 — Replace a barber's service assignments atomically.

create or replace function public.set_barber_services(
  p_shop_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_ids uuid[] := coalesce(p_service_ids, array[]::uuid[]);
  v_valid_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;

  if not public.is_shop_member(p_shop_id, '{owner,manager}') then
    raise exception 'Shop manager access required.'
      using errcode = '42501';
  end if;

  if p_barber_id is null
    or cardinality(v_service_ids) > 100
    or not exists (
      select 1
      from public.barbers barber
      where barber.shop_id = p_shop_id
        and barber.id = p_barber_id
        and barber.is_active
    )
  then
    raise exception 'Barber or service selection is invalid.'
      using errcode = '22023';
  end if;

  select count(*) into v_valid_count
  from (
    select distinct selected.service_id
    from unnest(v_service_ids) as selected(service_id)
  ) selected
  join public.shop_services service
    on service.shop_id = p_shop_id
    and service.id = selected.service_id
    and service.is_active;

  if v_valid_count <> cardinality(v_service_ids) then
    raise exception 'Service selection is invalid.'
      using errcode = '22023';
  end if;

  delete from public.barber_services assignment
  where assignment.shop_id = p_shop_id
    and assignment.barber_id = p_barber_id;

  insert into public.barber_services (shop_id, barber_id, service_id)
  select p_shop_id, p_barber_id, selected.service_id
  from unnest(v_service_ids) as selected(service_id);
end;
$$;

revoke execute on function public.set_barber_services(uuid, uuid, uuid[])
  from public, anon;
grant execute on function public.set_barber_services(uuid, uuid, uuid[])
  to authenticated;
