-- 0018 — One weekly rest day replaces date-based shop holidays.
--
-- A Tunisian shop closes on the same weekday every week and that day is chosen
-- by the owner, so availability is now "never book the rest day" instead of a
-- holiday calendar a shop would have to maintain and advertise. Customers see a
-- closed weekday in the opening hours and nothing else.

-- ── column ──
alter table public.barbershops
  add column if not exists closed_weekday smallint
  check (closed_weekday between 0 and 6);

comment on column public.barbershops.closed_weekday is
  'Weekday the shop never works: 0 = Sunday through 6 = Saturday.';

-- ── backfill the weekday a shop already keeps shut ──
-- A shop that omits exactly one weekday of opening hours keeps that habit;
-- every other shop waits for its owner to choose, which now blocks publishing.
update public.barbershops shop
set closed_weekday = observed.weekday
from (
  select base.shop_id, min(base.weekday) as weekday
  from (
    select candidate.id as shop_id, weekday.value as weekday
    from public.barbershops candidate
    cross join generate_series(0, 6) as weekday(value)
    where not exists (
      select 1
      from public.shop_business_hours hours
      where hours.shop_id = candidate.id
        and hours.weekday = weekday.value
    )
  ) base
  group by base.shop_id
  having count(*) = 1
) observed
where shop.id = observed.shop_id
  and shop.closed_weekday is null;

-- ── the rest day cannot carry opening hours ──
create or replace function public.guard_shop_rest_day()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.barbershops shop
    where shop.id = new.shop_id
      and shop.closed_weekday = new.weekday
  ) then
    raise exception 'The weekly rest day cannot have opening hours.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_shop_rest_day()
  from public, anon, authenticated;

create trigger shop_business_hours_rest_day
  before insert or update on public.shop_business_hours
  for each row execute function public.guard_shop_rest_day();

-- ── choosing the rest day clears that day's hours in the same statement ──
create or replace function public.set_shop_rest_day(
  p_shop_id uuid,
  p_weekday smallint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
    or not public.is_shop_member(p_shop_id, '{owner,manager}')
  then
    raise exception 'Shop manager access required.'
      using errcode = '42501';
  end if;
  if p_weekday is null or p_weekday not between 0 and 6 then
    raise exception 'The weekly rest day must be a weekday between 0 and 6.'
      using errcode = '22023';
  end if;

  update public.barbershops
  set closed_weekday = p_weekday
  where id = p_shop_id;

  delete from public.shop_business_hours
  where shop_id = p_shop_id
    and weekday = p_weekday;

  return true;
end;
$$;

revoke execute on function public.set_shop_rest_day(uuid, smallint)
  from public, anon;
grant execute on function public.set_shop_rest_day(uuid, smallint)
  to authenticated;

-- ── a shop without a rest day is not ready to publish ──
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
    ) then 'barber_schedules' end,
    case when coalesce(cardinality(shop.gallery_paths), 0) < 3 then
      'shop_media'
    end,
    case when shop.closed_weekday is null then 'rest_day' end
  ], null) into v_missing
  from public.barbershops shop
  where shop.id = p_shop_id;

  return coalesce(v_missing, '{}');
end;
$$;

revoke execute on function public.shop_website_missing_requirements(uuid)
  from public, anon;
grant execute on function public.shop_website_missing_requirements(uuid)
  to authenticated;

-- ── availability skips the rest day and no longer knows about holidays ──
create or replace function public.get_available_slots(
  p_shop_id uuid,
  p_barber_id uuid,
  p_service_id uuid,
  p_date date
)
returns table (slot_start timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct (slot.local_start at time zone 'Africa/Tunis') as slot_start
  from public.shop_business_hours sh
  join public.barber_schedules schedule
    on schedule.shop_id = sh.shop_id
    and schedule.weekday = sh.weekday
  join public.shop_services service
    on service.shop_id = sh.shop_id
    and service.is_active
  join public.barber_services assignment
    on assignment.shop_id = sh.shop_id
    and assignment.service_id = service.id
    and assignment.barber_id = schedule.barber_id
  join public.barbers barber
    on barber.shop_id = schedule.shop_id
    and barber.id = schedule.barber_id
    and barber.is_active
  join public.barbershops shop
    on shop.id = sh.shop_id
    and shop.is_published
    and not shop.is_suspended
    and sh.weekday <> coalesce(shop.closed_weekday, -1)
  cross join lateral generate_series(
    p_date + greatest(sh.opens_at, schedule.starts_at),
    p_date + least(sh.closes_at, schedule.ends_at)
      - make_interval(mins => service.duration_minutes + service.buffer_minutes),
    interval '15 minutes'
  ) as slot(local_start)
  where sh.shop_id = p_shop_id
    -- A weekday's opening hours only apply to a date that actually is that
    -- weekday, which is what makes the rest day (and every other closed
    -- weekday) unbookable.
    and sh.weekday = (extract(dow from p_date)::int)
    and schedule.barber_id = p_barber_id
    and service.id = p_service_id
    and p_date >= (now() at time zone 'Africa/Tunis')::date
    and p_date <= (now() at time zone 'Africa/Tunis')::date + 60
    and slot.local_start > (now() at time zone 'Africa/Tunis')
    and not exists (
      select 1 from public.barber_days_off day_off
      where day_off.shop_id = schedule.shop_id
        and day_off.barber_id = schedule.barber_id
        and p_date between day_off.starts_on and day_off.ends_on
    )
    and not exists (
      select 1 from public.barber_breaks pause
      where pause.shop_id = schedule.shop_id
        and pause.barber_id = schedule.barber_id
        and pause.weekday = schedule.weekday
        and slot.local_start::time
          < pause.ends_at
        and (slot.local_start + make_interval(
          mins => service.duration_minutes + service.buffer_minutes
        ))::time > pause.starts_at
    )
    and not exists (
      select 1 from public.appointments appointment
      where appointment.shop_id = schedule.shop_id
        and appointment.barber_id = schedule.barber_id
        and appointment.status = 'confirmed'
        and tstzrange(
          appointment.starts_at,
          appointment.occupied_until,
          '[)'
        ) && tstzrange(
          slot.local_start at time zone 'Africa/Tunis',
          (slot.local_start + make_interval(
            mins => service.duration_minutes + service.buffer_minutes
          )) at time zone 'Africa/Tunis',
          '[)'
        )
    );
$$;

revoke execute on function public.get_available_slots(uuid, uuid, uuid, date)
  from public;
grant execute on function public.get_available_slots(uuid, uuid, uuid, date)
  to anon, authenticated;

-- ── the holiday calendar is gone ──
drop table if exists public.shop_holidays;

-- ── the rest day is part of what a published shop advertises ──
grant select (closed_weekday)
  on public.barbershops to anon, authenticated;

create or replace view public.public_barbershops
with (security_invoker = true)
as
select
  id,
  name,
  slug,
  city,
  address,
  phone,
  description,
  template_id,
  logo_path,
  cover_path,
  gallery_paths,
  closed_weekday
from public.barbershops
where is_published and not is_suspended;

grant select on public.public_barbershops to anon, authenticated;
