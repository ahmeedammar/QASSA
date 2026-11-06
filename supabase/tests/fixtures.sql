-- Disposable fixtures for the scratch database only. Two tenants, staff with
-- different roles, and two customers, all with fixed IDs used by the tests.

\set owner_a         '00000000-0000-4000-a000-000000000001'
\set owner_b         '00000000-0000-4000-a000-000000000002'
\set manager_a       '00000000-0000-4000-a000-000000000003'
\set staff_barber_a  '00000000-0000-4000-a000-000000000004'
\set customer_1      '00000000-0000-4000-a000-000000000011'
\set customer_2      '00000000-0000-4000-a000-000000000012'
\set ops_admin       '00000000-0000-4000-a000-000000000021'
\set support_admin   '00000000-0000-4000-a000-000000000022'
\set finance_admin   '00000000-0000-4000-a000-000000000023'
\set shop_a          '10000000-0000-4000-a000-000000000001'
\set shop_b          '10000000-0000-4000-a000-000000000002'
\set service_a       '20000000-0000-4000-a000-000000000001'
\set service_a_other '20000000-0000-4000-a000-000000000002'
\set service_b       '20000000-0000-4000-a000-000000000003'
\set barber_a1       '30000000-0000-4000-a000-000000000001'
\set barber_a2       '30000000-0000-4000-a000-000000000002'
\set barber_b        '30000000-0000-4000-a000-000000000003'

reset role;

insert into auth.users (id, email, raw_user_meta_data) values
  (:'owner_a', 'owner-a@scratch.test', '{"full_name":"Owner A"}'),
  (:'owner_b', 'owner-b@scratch.test', '{"full_name":"Owner B"}'),
  (:'manager_a', 'manager-a@scratch.test', '{}'),
  (:'staff_barber_a', 'barber-a@scratch.test', '{}'),
  (:'customer_1', 'customer-1@scratch.test', '{"locale":"ar"}'),
  (:'customer_2', 'customer-2@scratch.test', '{}'),
  (:'ops_admin', 'ops-admin@scratch.test', '{}'),
  (:'support_admin', 'support-admin@scratch.test', '{}'),
  (:'finance_admin', 'finance-admin@scratch.test', '{}');

insert into public.platform_admins (user_id, role) values
  (:'ops_admin', 'operations_admin'),
  (:'support_admin', 'support_admin'),
  (:'finance_admin', 'finance_admin');

-- ── availability calendar ──
-- day_d is one week out; the weekly rest day is three weekdays later, so neither
-- day_d nor day_d + 1 accidentally lands on a closed day, and day_rest is the
-- first date that actually is one.
select (now() at time zone 'Africa/Tunis')::date + 7 as day_d \gset
select mod(extract(dow from :'day_d'::date)::int + 3, 7) as rest_day \gset
select (:'day_d'::date + 3) as day_rest \gset

insert into public.barbershops (id, owner_id, name, slug, city, closed_weekday) values
  (:'shop_a', :'owner_a', 'Scratch Shop A', 'scratch-shop-a', 'Tunis', :'rest_day'::int),
  (:'shop_b', :'owner_b', 'Scratch Shop B', 'scratch-shop-b', 'Sfax', :'rest_day'::int);

insert into public.shop_members (shop_id, user_id, role) values
  (:'shop_a', :'owner_a', 'owner'),
  (:'shop_a', :'manager_a', 'manager'),
  (:'shop_a', :'staff_barber_a', 'barber'),
  (:'shop_b', :'owner_b', 'owner');

insert into public.shop_services
  (id, shop_id, name, duration_minutes, buffer_minutes, price_tnd) values
  (:'service_a', :'shop_a', 'Coupe', 30, 10, 25.000),
  (:'service_a_other', :'shop_a', 'Barbe', 20, 0, 15.000),
  (:'service_b', :'shop_b', 'Coupe B', 30, 0, 20.000);

insert into public.barbers (id, shop_id, display_name) values
  (:'barber_a1', :'shop_a', 'Barber A1'),
  (:'barber_a2', :'shop_a', 'Barber A2'),
  (:'barber_b', :'shop_b', 'Barber B');

insert into public.barber_services (shop_id, barber_id, service_id) values
  (:'shop_a', :'barber_a1', :'service_a'),
  (:'shop_b', :'barber_b', :'service_b');

-- Opening hours cover every weekday except the shop's rest day, which the
-- 0018 trigger refuses to accept hours for.
insert into public.shop_business_hours (shop_id, weekday, opens_at, closes_at)
select shop_id, weekday, '09:00', '19:00'
from (values (:'shop_a'::uuid), (:'shop_b'::uuid)) as shops(shop_id)
cross join generate_series(0, 6) as weekday
where weekday <> :'rest_day'::int;

insert into public.barber_schedules (shop_id, barber_id, weekday, starts_at, ends_at)
select shop_id, barber_id, weekday, '09:00', '19:00'
from (values
  (:'shop_a'::uuid, :'barber_a1'::uuid),
  (:'shop_b'::uuid, :'barber_b'::uuid)
) as staff(shop_id, barber_id)
cross join generate_series(0, 6) as weekday;

insert into public.barber_breaks (shop_id, barber_id, weekday, starts_at, ends_at)
select :'shop_a', :'barber_a1', weekday, '13:00', '14:00'
from generate_series(0, 6) as weekday;

-- Storefront media, because the publication guard expects a real gallery.
-- These paths also exercise the media trigger against each shop's own folder.
update public.barbershops b
set logo_path = b.id::text || '/logo/00000000-0000-4000-a000-000000000002.webp',
    cover_path = b.id::text || '/cover/00000000-0000-4000-a000-000000000001.webp',
    gallery_paths = array[
      b.id::text || '/gallery/00000000-0000-4000-a000-000000000011.webp',
      b.id::text || '/gallery/00000000-0000-4000-a000-000000000012.webp',
      b.id::text || '/gallery/00000000-0000-4000-a000-000000000013.jpg'
    ]
where b.id in (:'shop_a', :'shop_b');

-- The publication guard checks the caller's manager access.
select set_config('request.jwt.claim.sub', :'owner_a', false);
update public.barbershops set is_published = true where id = :'shop_a';
select set_config('request.jwt.claim.sub', :'owner_b', false);
update public.barbershops set is_published = true where id = :'shop_b';
select set_config('request.jwt.claim.sub', '', false);
