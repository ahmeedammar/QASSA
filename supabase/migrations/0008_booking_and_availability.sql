-- 0008 — Barber schedules and concurrency-safe appointment reservations.

create extension if not exists btree_gist;

create table public.barber_schedules (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  barber_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (shop_id, id),
  unique (shop_id, barber_id, weekday, starts_at),
  foreign key (shop_id, barber_id)
    references public.barbers(shop_id, id) on delete cascade
);

create index barber_schedules_lookup_idx
  on public.barber_schedules(shop_id, barber_id, weekday);

create table public.barber_breaks (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  barber_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (shop_id, barber_id)
    references public.barbers(shop_id, id) on delete cascade
);

create index barber_breaks_lookup_idx
  on public.barber_breaks(shop_id, barber_id, weekday);

create table public.barber_days_off (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  barber_id uuid not null,
  starts_on date not null,
  ends_on date not null,
  reason text,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  foreign key (shop_id, barber_id)
    references public.barbers(shop_id, id) on delete cascade
);

create index barber_days_off_lookup_idx
  on public.barber_days_off(shop_id, barber_id, starts_on, ends_on);

create table public.shop_holidays (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  holiday_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (shop_id, holiday_date)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete restrict,
  customer_id uuid not null references auth.users(id) on delete restrict,
  barber_id uuid not null,
  idempotency_key uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  occupied_until timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  customer_note text check (
    customer_note is null or char_length(customer_note) <= 500
  ),
  cancellation_reason text check (
    cancellation_reason is null or char_length(cancellation_reason) <= 250
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (occupied_until >= ends_at),
  unique (customer_id, idempotency_key),
  unique (shop_id, id),
  foreign key (shop_id, barber_id)
    references public.barbers(shop_id, id) on delete restrict,
  exclude using gist (
    shop_id with =,
    barber_id with =,
    tstzrange(starts_at, occupied_until, '[)') with &&
  ) where (status = 'confirmed')
);

create trigger appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

create index appointments_customer_history_idx
  on public.appointments(customer_id, starts_at desc);
create index appointments_shop_calendar_idx
  on public.appointments(shop_id, starts_at)
  where status = 'confirmed';
create index appointments_barber_calendar_idx
  on public.appointments(shop_id, barber_id, starts_at)
  where status = 'confirmed';

create table public.appointment_services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null,
  appointment_id uuid not null,
  service_id uuid not null,
  service_name text not null,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_minutes integer not null check (buffer_minutes between 0 and 120),
  price_tnd numeric(10, 3) not null check (price_tnd >= 0),
  created_at timestamptz not null default now(),
  foreign key (shop_id, appointment_id)
    references public.appointments(shop_id, id) on delete cascade,
  foreign key (shop_id, service_id)
    references public.shop_services(shop_id, id) on delete restrict
);

create index appointment_services_appointment_idx
  on public.appointment_services(shop_id, appointment_id);

alter table public.barber_schedules enable row level security;
alter table public.barber_breaks enable row level security;
alter table public.barber_days_off enable row level security;
alter table public.shop_holidays enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_services enable row level security;

create policy barber_schedules_member_read on public.barber_schedules
  for select to authenticated
  using (public.is_shop_member(shop_id));
create policy barber_schedules_manager_write on public.barber_schedules
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy barber_breaks_member_read on public.barber_breaks
  for select to authenticated
  using (public.is_shop_member(shop_id));
create policy barber_breaks_manager_write on public.barber_breaks
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy barber_days_off_member_read on public.barber_days_off
  for select to authenticated
  using (public.is_shop_member(shop_id));
create policy barber_days_off_manager_write on public.barber_days_off
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy shop_holidays_member_read on public.shop_holidays
  for select to authenticated
  using (public.is_shop_member(shop_id));
create policy shop_holidays_manager_write on public.shop_holidays
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy appointments_customer_or_member_read on public.appointments
  for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_shop_member(shop_id)
  );
create policy appointment_services_customer_or_member_read
  on public.appointment_services
  for select to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.shop_id = appointment_services.shop_id
        and a.id = appointment_services.appointment_id
        and (a.customer_id = auth.uid() or public.is_shop_member(a.shop_id))
    )
  );

grant select, insert, update, delete on public.barber_schedules,
  public.barber_breaks, public.barber_days_off, public.shop_holidays
  to authenticated;
grant select on public.appointments, public.appointment_services
  to authenticated;
revoke insert, update, delete on public.appointments,
  public.appointment_services from anon, authenticated;

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
  cross join lateral generate_series(
    p_date + greatest(sh.opens_at, schedule.starts_at),
    p_date + least(sh.closes_at, schedule.ends_at)
      - make_interval(mins => service.duration_minutes + service.buffer_minutes),
    interval '15 minutes'
  ) as slot(local_start)
  where sh.shop_id = p_shop_id
    and schedule.barber_id = p_barber_id
    and service.id = p_service_id
    and p_date >= (now() at time zone 'Africa/Tunis')::date
    and p_date <= (now() at time zone 'Africa/Tunis')::date + 60
    and slot.local_start > (now() at time zone 'Africa/Tunis')
    and not exists (
      select 1 from public.shop_holidays holiday
      where holiday.shop_id = sh.shop_id
        and holiday.holiday_date = p_date
    )
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

create or replace function public.book_appointment(
  p_shop_id uuid,
  p_barber_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_existing public.appointments%rowtype;
  v_appointment_id uuid;
  v_service public.shop_services%rowtype;
  v_slot_exists boolean;
begin
  if v_customer_id is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if p_idempotency_key is null or p_starts_at is null then
    raise exception 'A valid reservation request is required.'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.appointments a
  where a.customer_id = v_customer_id
    and a.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.shop_id <> p_shop_id
      or v_existing.barber_id <> p_barber_id
      or v_existing.starts_at <> p_starts_at
      or not exists (
        select 1 from public.appointment_services aservice
        where aservice.shop_id = v_existing.shop_id
          and aservice.appointment_id = v_existing.id
          and aservice.service_id = p_service_id
      )
    then
      raise exception 'Idempotency key was already used for another booking.'
        using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  select service.* into v_service
  from public.shop_services service
  join public.barber_services assignment
    on assignment.shop_id = service.shop_id
    and assignment.service_id = service.id
    and assignment.barber_id = p_barber_id
  where service.shop_id = p_shop_id
    and service.id = p_service_id
    and service.is_active;

  if not found then
    raise exception 'This service is not available from the selected barber.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.get_available_slots(
      p_shop_id,
      p_barber_id,
      p_service_id,
      (p_starts_at at time zone 'Africa/Tunis')::date
    ) available
    where available.slot_start = p_starts_at
  ) into v_slot_exists;

  if not v_slot_exists then
    raise exception 'This appointment time is no longer available.'
      using errcode = 'P0001';
  end if;

  insert into public.appointments (
    shop_id,
    customer_id,
    barber_id,
    idempotency_key,
    starts_at,
    ends_at,
    occupied_until
  ) values (
    p_shop_id,
    v_customer_id,
    p_barber_id,
    p_idempotency_key,
    p_starts_at,
    p_starts_at + make_interval(mins => v_service.duration_minutes),
    p_starts_at + make_interval(
      mins => v_service.duration_minutes + v_service.buffer_minutes
    )
  )
  on conflict (customer_id, idempotency_key) do nothing
  returning id into v_appointment_id;

  if v_appointment_id is null then
    select * into v_existing
    from public.appointments a
    where a.customer_id = v_customer_id
      and a.idempotency_key = p_idempotency_key;
    if not found
      or v_existing.shop_id <> p_shop_id
      or v_existing.barber_id <> p_barber_id
      or v_existing.starts_at <> p_starts_at
      or not exists (
        select 1 from public.appointment_services aservice
        where aservice.shop_id = v_existing.shop_id
          and aservice.appointment_id = v_existing.id
          and aservice.service_id = p_service_id
      )
    then
      raise exception 'Idempotency key was already used for another booking.'
        using errcode = '22023';
    end if;
    return v_existing.id;
  end if;

  insert into public.appointment_services (
    shop_id,
    appointment_id,
    service_id,
    service_name,
    duration_minutes,
    buffer_minutes,
    price_tnd
  ) values (
    p_shop_id,
    v_appointment_id,
    v_service.id,
    v_service.name,
    v_service.duration_minutes,
    v_service.buffer_minutes,
    v_service.price_tnd
  );

  return v_appointment_id;
end;
$$;

revoke execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, uuid)
  from public, anon;
grant execute on function public.book_appointment(uuid, uuid, uuid, timestamptz, uuid)
  to authenticated;

create or replace function public.cancel_appointment(
  p_appointment_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if p_reason is not null and char_length(p_reason) > 250 then
    raise exception 'Cancellation reason is too long.'
      using errcode = '22023';
  end if;

  select * into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and (
      a.customer_id = v_user_id
      or public.is_shop_member(a.shop_id, '{owner,manager}')
    )
  for update;

  if not found then
    return false;
  end if;
  if v_appointment.status <> 'confirmed' then
    return false;
  end if;

  update public.appointments
  set status = 'cancelled',
      cancellation_reason = p_reason
  where id = v_appointment.id;

  return true;
end;
$$;

revoke execute on function public.cancel_appointment(uuid, text)
  from public, anon;
grant execute on function public.cancel_appointment(uuid, text)
  to authenticated;
