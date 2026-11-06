-- Adversarial security tests for QASSA — Milestone 6.
-- Runs after fixtures.sql in the same psql session, as the real
-- anon/authenticated API roles.
--
-- Sections:
--   A. RLS — direct table write bypass attempts (authenticated)
--   B. RLS — public_barbershops view is read-only
--   C. Audit log tamper-resistance
--   D. platform_admins tamper-resistance
--   E. shop_members tamper-resistance
--   F. Cross-tenant read isolation
--   G. Availability — unpublished shop

reset role;

-- ── Slot variable setup (mirrors the pattern in booking.test.sql) ────────────
select ((:'day_d'::date + time '10:00') at time zone 'Africa/Tunis') as slot_1000,
       ((:'day_d'::date + time '10:30') at time zone 'Africa/Tunis') as slot_1030
\gset

-- ── A. RLS — direct table write bypass attempts (authenticated) ───────────────
-- The API roles keep their table privileges, so RLS refuses an unauthorised
-- UPDATE or DELETE by matching no visible row rather than by raising. Only
-- statements blocked by a privilege revoke or a WITH CHECK clause error out.

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select qassa_test.throws(
  format('insert into public.barbershops (owner_id, name, slug, city) values (%L, %L, %L, %L)',
    :'customer_1', 'Hacked Shop', 'hacked-shop', 'Tunis'),
  '42501', 'customer cannot INSERT into barbershops');

select qassa_test.affects_no_rows(
  format('update public.barbershops set name = %L where id = %L', 'hacked', :'shop_a'),
  'customer cannot UPDATE barbershops');

select qassa_test.affects_no_rows(
  format('delete from public.barbershops where id = %L', :'shop_a'),
  'customer cannot DELETE from barbershops');

select qassa_test.throws(
  format('insert into public.barbers (shop_id, display_name) values (%L, %L)',
    :'shop_a', 'injected'),
  '42501', 'customer cannot INSERT into barbers');

select qassa_test.affects_no_rows(
  format('update public.shop_services set price_tnd = 0 where id = %L', :'service_a'),
  'customer cannot UPDATE shop_services price');

-- Cross-tenant: owner_b tries to tamper with shop_a data
select set_config('request.jwt.claim.sub', :'owner_b', false);

select qassa_test.affects_no_rows(
  format('update public.shop_services set price_tnd = 0 where id = %L', :'service_a'),
  'owner_b cannot UPDATE shop_a services (cross-tenant)');

select qassa_test.affects_no_rows(
  format('update public.barbers set display_name = %L where id = %L', 'x', :'barber_a1'),
  'owner_b cannot UPDATE shop_a barbers (cross-tenant)');

-- Cross-tenant appointment read isolation: owner_b sees zero appointments for shop_a
select qassa_test.ok(
  (select count(*) from public.appointments where shop_id = :'shop_a') = 0,
  'owner_b reads zero appointments from shop_a (RLS tenant isolation)');

reset role;
select qassa_test.ok(
  (select name from public.barbershops where id = :'shop_a') = 'Scratch Shop A'
    and (select price_tnd from public.shop_services where id = :'service_a') = 25.000
    and (select display_name from public.barbers where id = :'barber_a1') <> 'x',
  'refused write attempts leave shop_a content untouched');

-- ── B. RLS — public_barbershops view is read-only ────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select qassa_test.affects_no_rows(
  format('update public.public_barbershops set name = %L where id = %L', 'hacked', :'shop_a'),
  'customer cannot UPDATE public_barbershops view');

select qassa_test.affects_no_rows(
  format('delete from public.public_barbershops where id = %L', :'shop_a'),
  'customer cannot DELETE from public_barbershops view');

reset role;

-- ── C. Audit log tamper-resistance ───────────────────────────────────────────

-- ops_admin is an authenticated platform admin — they should still be blocked.
set role authenticated;
select set_config('request.jwt.claim.sub', :'ops_admin', false);

select qassa_test.throws(
  'delete from public.audit_logs',
  '42501', 'ops_admin cannot DELETE from audit_logs');

select qassa_test.throws(
  format('update public.audit_logs set action = %L', 'fake'),
  '42501', 'ops_admin cannot UPDATE audit_logs');

select qassa_test.throws(
  format('insert into public.audit_logs (action) values (%L)', 'forged'),
  '42501', 'ops_admin cannot INSERT into audit_logs');

reset role;

-- ── D. platform_admins tamper-resistance ────────────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select qassa_test.throws(
  format('insert into public.platform_admins (user_id, role) values (%L, %L)',
    :'customer_1', 'platform_owner'),
  '42501', 'customer cannot INSERT into platform_admins');

select qassa_test.throws(
  format('update public.platform_admins set role = %L', 'platform_owner'),
  '42501', 'customer cannot UPDATE platform_admins role');

select set_config('request.jwt.claim.sub', :'owner_a', false);

select qassa_test.throws(
  format('insert into public.platform_admins (user_id, role) values (%L, %L)',
    :'owner_a', 'super_admin'),
  '42501', 'shop owner cannot INSERT into platform_admins');

reset role;

-- ── E. shop_members tamper-resistance ───────────────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select qassa_test.throws(
  format('insert into public.shop_members (shop_id, user_id, role) values (%L, %L, %L)',
    :'shop_a', :'customer_1', 'owner'),
  '42501', 'customer cannot INSERT into shop_members');

select qassa_test.throws(
  format('update public.shop_members set role = %L', 'owner'),
  '42501', 'customer cannot UPDATE shop_members role');

reset role;

-- ── F. Cross-tenant read isolation ──────────────────────────────────────────
-- Published storefront content (services, barbers, hours) is deliberately
-- readable by anyone; settings and scheduling internals must never leak.

set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_b', false);

select qassa_test.ok(
  (select count(*) from public.shop_settings where shop_id = :'shop_a') = 0,
  'owner_b reads no shop_settings for shop_a (RLS blocks cross-tenant settings read)');

select qassa_test.ok(
  (select count(*) from public.barber_schedules where shop_id = :'shop_a') = 0,
  'owner_b reads no barber_schedules for shop_a (RLS blocks cross-tenant schedule read)');

select qassa_test.ok(
  (select count(*) from public.shop_services where shop_id = :'shop_a') = 2,
  'published storefront services stay publicly readable by design');

reset role;

-- ── G. Availability — unpublished shop ──────────────────────────────────────

reset role;
-- The suspension guard only fires on is_suspended/suspension_reason changes,
-- so a direct superuser UPDATE of is_published requires no bypass config.
update public.barbershops set is_published = false where id = :'shop_a';

set role anon;
select set_config('request.jwt.claim.sub', '', false);

select qassa_test.ok(
  (select count(*) from public.public_barbershops where id = :'shop_a') = 0,
  'anon sees unpublished shop_a as hidden in public_barbershops');

-- Restore so subsequent tests are not affected. Publication goes through the
-- owner's RPC because the readiness guard needs a manager identity.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a', false);
select qassa_test.ok(
  (public.set_shop_published(:'shop_a', true) ->> 'published')::boolean,
  'owner republishes shop_a through the publication RPC');

-- ── H. Storefront media (0015) ───────────────────────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a', false);

-- Paths are bound to the owning shop's folder, both in the RPC and in Storage.
select qassa_test.throws(
  format('select public.update_shop_media(%L, null, %L)',
    :'shop_a', :'shop_b' || '/cover/00000000-0000-4000-a000-000000000099.webp'),
  '22023', 'owner cannot point the shop cover at another shop folder');

select qassa_test.throws(
  format('select public.update_shop_media(%L, null, null, array[%L]::text[])',
    :'shop_a', :'shop_b' || '/gallery/00000000-0000-4000-a000-000000000099.webp'),
  '22023', 'owner cannot inject another shop gallery path');

select qassa_test.throws(
  format('select public.update_shop_media(%L, null, null, array[%L]::text[])',
    :'shop_a', :'shop_a' || '/gallery/not-a-uuid.webp'),
  '22023', 'gallery paths must use an opaque uuid filename');

select qassa_test.throws(
  format('update public.barbers set avatar_path = %L where id = %L',
    :'shop_b' || '/avatar/00000000-0000-4000-a000-000000000099.webp', :'barber_a1'),
  '22023', 'barber photo must live in the owning shop folder');

select qassa_test.throws(
  format('select public.update_shop_media(%L, null, null, '
    || '(select array_agg(%L || ''/gallery/00000000-0000-4000-a000-'' '
    || '|| lpad(g::text, 12, %L) || %L) from generate_series(1, 13) g))',
    :'shop_a', :'shop_a', '0', '.webp'),
  '22023', 'a shop may attach at most 12 gallery images');

-- A manager of another shop has no access to this shop's media at all.
select set_config('request.jwt.claim.sub', :'owner_b', false);
select qassa_test.throws(
  format('select public.update_shop_media(%L, null, %L)',
    :'shop_a', :'shop_a' || '/cover/00000000-0000-4000-a000-000000000098.webp'),
  '42501', 'other shop owner cannot rewrite shop_a media');

select qassa_test.throws(
  format('insert into storage.objects (bucket_id, name) values (%L, %L)',
    'shop-media', :'shop_a' || '/cover/00000000-0000-4000-a000-000000000097.webp'),
  '42501', 'other shop owner cannot upload into shop_a folder');

select set_config('request.jwt.claim.sub', :'customer_1', false);
select qassa_test.throws(
  format('select public.update_shop_media(%L, null, null, array[%L]::text[])',
    :'shop_a', :'shop_a' || '/gallery/00000000-0000-4000-a000-000000000096.webp'),
  '42501', 'customer cannot call update_shop_media');

-- The owner's own writes succeed, and duplicate gallery entries collapse to one
-- image in the order the owner chose.
select set_config('request.jwt.claim.sub', :'owner_a', false);
select public.update_shop_media(
  :'shop_a',
  :'shop_a' || '/logo/00000000-0000-4000-a000-0000000000b1.webp',
  :'shop_a' || '/cover/00000000-0000-4000-a000-0000000000b2.webp',
  array[:'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b3.webp',
        :'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b4.jpg',
        :'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b3.webp']);

select qassa_test.ok(
  (select logo_path like :'shop_a' || '/logo/%'
          and cover_path like :'shop_a' || '/cover/%'
          and gallery_paths = array[
            :'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b3.webp',
            :'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b4.jpg']
     from public.barbershops where id = :'shop_a'),
  'owner media save de-duplicates the gallery and keeps the chosen order');

insert into storage.objects (bucket_id, name)
  values ('shop-media', :'shop_a' || '/cover/00000000-0000-4000-a000-0000000000b5.webp');
select qassa_test.ok(
  exists (select 1 from storage.objects
           where bucket_id = 'shop-media' and name like :'shop_a' || '/%'),
  'shop owner uploads into the shop media bucket');

-- ── media is a publication requirement ──

reset role;
update public.barbershops set gallery_paths = '{}' where id = :'shop_a';

set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a', false);

select qassa_test.ok(
  public.shop_website_missing_requirements(:'shop_a') = array['shop_media'],
  'an empty gallery is the only outstanding publication requirement');

select qassa_test.ok(
  (select public.set_shop_published(:'shop_a', true) -> 'missing')
    @> '["shop_media"]'::jsonb,
  'publishing is refused until the shop has gallery images');

select public.update_shop_media(
  :'shop_a',
  :'shop_a' || '/logo/00000000-0000-4000-a000-0000000000b1.webp',
  :'shop_a' || '/cover/00000000-0000-4000-a000-0000000000b2.webp',
  array[:'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b3.webp',
        :'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b4.jpg',
        :'shop_a' || '/gallery/00000000-0000-4000-a000-0000000000b6.png']);

select qassa_test.ok(
  public.shop_website_missing_requirements(:'shop_a') = '{}'
    and (public.set_shop_published(:'shop_a', true) ->> 'published')::boolean,
  'three gallery images return the shop to a publishable state');

-- Leave the scratch bucket and the shop row as the fixtures created them.
select public.update_shop_media(
  :'shop_a',
  :'shop_a' || '/logo/00000000-0000-4000-a000-000000000002.webp',
  :'shop_a' || '/cover/00000000-0000-4000-a000-000000000001.webp',
  array[:'shop_a' || '/gallery/00000000-0000-4000-a000-000000000011.webp',
        :'shop_a' || '/gallery/00000000-0000-4000-a000-000000000012.webp',
        :'shop_a' || '/gallery/00000000-0000-4000-a000-000000000013.jpg']);
reset role;
delete from storage.objects where bucket_id = 'shop-media';

-- ── I. Weekly rest day (0018) ────────────────────────────────────────────────
-- The rest day is the only closure a shop publishes, so choosing it must be a
-- manager action, must reject nonsense weekdays, and must stay consistent with
-- the opening-hours rows it replaces.

reset role;
select mod(extract(dow from :'day_d'::date)::int + 1, 7) as rest_day_2 \gset
select (:'day_d'::date + 1) as day_rest_2 \gset

set role anon;
select set_config('request.jwt.claim.sub', '', false);
select qassa_test.throws(
  format('select public.set_shop_rest_day(%L::uuid, 2::smallint)', :'shop_a'),
  '42501', 'anon cannot choose a shop rest day');

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);
select qassa_test.throws(
  format('select public.set_shop_rest_day(%L::uuid, 2::smallint)', :'shop_a'),
  '42501', 'a customer cannot choose a shop rest day');

select set_config('request.jwt.claim.sub', :'owner_b', false);
select qassa_test.throws(
  format('select public.set_shop_rest_day(%L::uuid, 2::smallint)', :'shop_a'),
  '42501', 'another shop owner cannot choose shop_a rest day');

select set_config('request.jwt.claim.sub', :'owner_a', false);
select qassa_test.throws(
  'select public.set_shop_rest_day(' || quote_literal(:'shop_a') || '::uuid, 7::smallint)',
  '22023', 'weekday 7 is not a rest day');
select qassa_test.throws(
  'select public.set_shop_rest_day(' || quote_literal(:'shop_a') || '::uuid, null)',
  '22023', 'a missing weekday is rejected');

select qassa_test.ok(
  public.set_shop_rest_day(:'shop_a', :'rest_day_2'::smallint),
  'owner chooses a new rest day');
select qassa_test.ok(
  (select closed_weekday from public.barbershops where id = :'shop_a') = :'rest_day_2'::smallint,
  'the rest day is stored on the shop');
select qassa_test.ok(
  not exists (
    select 1 from public.shop_business_hours
    where shop_id = :'shop_a' and weekday = :'rest_day_2'::int
  )
  and (select count(*) from public.get_available_slots(
         :'shop_a', :'barber_a1', :'service_a', :'day_rest_2')) = 0,
  'moving the rest day drops that weekday hours and sells nothing');
select qassa_test.ok(
  (select count(*) from public.get_available_slots(
     :'shop_a', :'barber_a1', :'service_a', :'day_d')) > 0,
  'the other open weekdays keep their slots');

select qassa_test.throws(
  format('insert into public.shop_business_hours (shop_id, weekday, opens_at, closes_at) '
    || 'values (%L, %L, %L, %L)', :'shop_a', :'rest_day_2'::int, '09:00', '19:00'),
  '22023', 'opening hours cannot be added on the rest day');

-- A shop that never picks a rest day is not publishable. shop_b stays out of
-- the booking assertions above, so it can carry this case.
reset role;
update public.barbershops set closed_weekday = null where id = :'shop_b';

set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_b', false);
select qassa_test.ok(
  public.shop_website_missing_requirements(:'shop_b') @> array['rest_day'],
  'missing rest day is reported as a publication requirement');
select qassa_test.ok(
  (select public.set_shop_published(:'shop_b', true) -> 'missing')
    @> '["rest_day"]'::jsonb,
  'publishing is refused until a rest day is chosen');
select qassa_test.ok(
  public.set_shop_rest_day(:'shop_b', :'rest_day'::smallint),
  'the owner of the incomplete shop picks its rest day');
select qassa_test.ok(
  public.shop_website_missing_requirements(:'shop_b') = '{}',
  'choosing the rest day completes the shop');

-- Leave shop_a as the fixtures configured it.
reset role;
update public.barbershops set closed_weekday = :'rest_day'::int where id = :'shop_a';
insert into public.shop_business_hours (shop_id, weekday, opens_at, closes_at)
select :'shop_a'::uuid, :'rest_day_2'::int, '09:00', '19:00';
reset role;
