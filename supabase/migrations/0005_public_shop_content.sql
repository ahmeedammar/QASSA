-- 0005 — Public shop content: services, barbers, assignments and hours

create table public.shop_services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 120),
  price_tnd numeric(10, 3) not null check (price_tnd >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);

create trigger shop_services_updated_at
  before update on public.shop_services
  for each row execute function public.set_updated_at();

create index shop_services_public_idx
  on public.shop_services(shop_id, display_order, name)
  where is_active;

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  bio text,
  avatar_path text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);

create trigger barbers_updated_at
  before update on public.barbers
  for each row execute function public.set_updated_at();

create index barbers_public_idx
  on public.barbers(shop_id, display_order, display_name)
  where is_active;

create table public.barber_services (
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  barber_id uuid not null,
  service_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (shop_id, barber_id, service_id),
  foreign key (shop_id, barber_id)
    references public.barbers(shop_id, id) on delete cascade,
  foreign key (shop_id, service_id)
    references public.shop_services(shop_id, id) on delete cascade
);

create index barber_services_service_idx
  on public.barber_services(shop_id, service_id);

create table public.shop_business_hours (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time not null,
  closes_at time not null,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at),
  unique (shop_id, weekday, opens_at)
);

create index shop_business_hours_public_idx
  on public.shop_business_hours(shop_id, weekday, opens_at);

alter table public.shop_services enable row level security;
alter table public.barbers enable row level security;
alter table public.barber_services enable row level security;
alter table public.shop_business_hours enable row level security;

create policy shop_services_public_read on public.shop_services
  for select to anon, authenticated
  using (
    is_active and exists (
      select 1 from public.barbershops b
      where b.id = shop_services.shop_id
        and b.is_published and not b.is_suspended
    )
  );

create policy shop_services_manager_all on public.shop_services
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy barbers_public_read on public.barbers
  for select to anon, authenticated
  using (
    is_active and exists (
      select 1 from public.barbershops b
      where b.id = barbers.shop_id
        and b.is_published and not b.is_suspended
    )
  );

create policy barbers_manager_all on public.barbers
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy barber_services_public_read on public.barber_services
  for select to anon, authenticated
  using (
    exists (
      select 1
      from public.barbers b
      join public.shop_services s
        on s.shop_id = barber_services.shop_id
        and s.id = barber_services.service_id
      join public.barbershops shop
        on shop.id = barber_services.shop_id
      where b.shop_id = barber_services.shop_id
        and b.id = barber_services.barber_id
        and b.is_active and s.is_active
        and shop.is_published and not shop.is_suspended
    )
  );

create policy barber_services_manager_all on public.barber_services
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

create policy shop_business_hours_public_read on public.shop_business_hours
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.barbershops b
      where b.id = shop_business_hours.shop_id
        and b.is_published and not b.is_suspended
    )
  );

create policy shop_business_hours_manager_all on public.shop_business_hours
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));

grant select on public.shop_services, public.barbers,
  public.barber_services, public.shop_business_hours
  to anon, authenticated;
grant insert, update, delete on public.shop_services, public.barbers,
  public.barber_services, public.shop_business_hours
  to authenticated;
