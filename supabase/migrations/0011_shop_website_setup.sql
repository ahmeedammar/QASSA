-- 0011 — Owner website settings and database-enforced publishing readiness.

create or replace function public.update_shop_website(
  p_shop_id uuid,
  p_name text,
  p_slug text,
  p_city text default null,
  p_address text default null,
  p_phone text default null,
  p_description text default null,
  p_template_id text default 'classic_gentleman'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_shop_id is null then
    raise exception 'A valid shop is required.'
      using errcode = '22023';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if not public.is_shop_member(p_shop_id, '{owner,manager}') then
    raise exception 'Shop manager access required.'
      using errcode = '42501';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 120
    or p_slug is null
    or p_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'
    or p_template_id is null
    or p_template_id not in (
      'royal_gold', 'urban_cut', 'classic_gentleman',
      'minimal_studio', 'dark_prestige'
    )
    or (p_city is not null and char_length(btrim(p_city)) > 120)
    or (p_address is not null and char_length(btrim(p_address)) > 240)
    or (p_phone is not null and char_length(btrim(p_phone)) > 40)
    or (p_description is not null and char_length(btrim(p_description)) > 2000)
  then
    raise exception 'Shop website details are invalid.'
      using errcode = '22023';
  end if;

  update public.barbershops
  set name = btrim(p_name),
      slug = p_slug,
      city = nullif(btrim(p_city), ''),
      address = nullif(btrim(p_address), ''),
      phone = nullif(btrim(p_phone), ''),
      description = nullif(btrim(p_description), ''),
      template_id = p_template_id
  where id = p_shop_id;

  if not found then
    raise exception 'Shop not found.'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_shop_website(
  uuid, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.update_shop_website(
  uuid, text, text, text, text, text, text, text
) to authenticated;

create or replace function public.shop_website_missing_requirements(
  p_shop_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if auth.uid() is null
    or not public.is_shop_member(p_shop_id, '{owner,manager}')
  then
    raise exception 'Shop manager access required.'
      using errcode = '42501';
  end if;

  select array_remove(array[
    case when not exists (
      select 1 from public.shop_services service
      where service.shop_id = p_shop_id
        and service.is_active
    ) then 'services' end,
    case when not exists (
      select 1
      from public.barbers barber
      join public.barber_services assignment
        on assignment.shop_id = barber.shop_id
        and assignment.barber_id = barber.id
      join public.shop_services service
        on service.shop_id = assignment.shop_id
        and service.id = assignment.service_id
      where barber.shop_id = p_shop_id
        and barber.is_active
        and service.is_active
    ) then 'barber_services' end,
    case when not exists (
      select 1 from public.shop_business_hours hours
      where hours.shop_id = p_shop_id
    ) then 'shop_hours' end,
    case when not exists (
      select 1
      from public.barber_schedules schedule
      join public.barbers barber
        on barber.shop_id = schedule.shop_id
        and barber.id = schedule.barber_id
        and barber.is_active
      where schedule.shop_id = p_shop_id
    ) then 'barber_schedules' end
  ], null) into v_missing;

  return v_missing;
end;
$$;

revoke execute on function public.shop_website_missing_requirements(uuid)
  from public, anon;
grant execute on function public.shop_website_missing_requirements(uuid)
  to authenticated;

create or replace function public.guard_shop_publication_readiness()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if new.is_published and (
    tg_op = 'INSERT'
    or not old.is_published
  ) then
    v_missing := public.shop_website_missing_requirements(new.id);
    if cardinality(v_missing) > 0 then
      raise exception 'Shop website is not ready to publish: %',
        array_to_string(v_missing, ', ')
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger barbershops_publication_readiness
  before insert or update of is_published on public.barbershops
  for each row execute function public.guard_shop_publication_readiness();

create or replace function public.set_shop_published(
  p_shop_id uuid,
  p_is_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if p_shop_id is null or p_is_published is null then
    raise exception 'A valid publication request is required.'
      using errcode = '22023';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if not public.is_shop_member(p_shop_id, '{owner,manager}') then
    raise exception 'Shop manager access required.'
      using errcode = '42501';
  end if;

  if p_is_published then
    v_missing := public.shop_website_missing_requirements(p_shop_id);
    if cardinality(v_missing) > 0 then
      return jsonb_build_object(
        'published', false,
        'missing', to_jsonb(v_missing)
      );
    end if;
  end if;

  update public.barbershops
  set is_published = p_is_published
  where id = p_shop_id
    and not is_suspended;

  if not found then
    raise exception 'Shop not found or suspended.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object('published', p_is_published, 'missing', '[]'::jsonb);
end;
$$;

revoke execute on function public.set_shop_published(uuid, boolean)
  from public, anon;
grant execute on function public.set_shop_published(uuid, boolean)
  to authenticated;
