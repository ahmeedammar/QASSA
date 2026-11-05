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
--   F. Booking — cross-tenant data reads
--   G. Availability — unpublished shop

reset role;

-- ── Slot variable setup (mirrors the pattern in booking.test.sql) ────────────
select ((:'day_d'::date + time '10:00') at time zone 'Africa/Tunis') as slot_1000,
       ((:'day_d'::date + time '10:30') at time zone 'Africa/Tunis') as slot_1030
\gset

-- ── A. RLS — direct table write bypass attempts (authenticated) ───────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select qassa_test.throws(
  format('insert into public.barbershops (owner_id, name, slug, city) values (%L, %L, %L, %L)',
    :'customer_1', 'Hacked Shop', 'hacked-shop', 'Tunis'),
  '42501', 'customer cannot INSERT into barbershops');

select qassa_test.throws(
  format('update public.barbershops set name = %L where id = %L', 'hacked', :'shop_a'),
  '42501', 'customer cannot UPDATE barbershops');

select qassa_test.throws(
  format('delete from public.barbershops where id = %L', :'shop_a'),
  '42501', 'customer cannot DELETE from barbershops');

select qassa_test.throws(
  format('insert into public.barbers (shop_id, display_name) values (%L, %L)',
    :'shop_a', 'injected'),
  '42501', 'customer cannot INSERT into barbers');

select qassa_test.throws(
  format('update public.shop_services set price_tnd = 0 where id = %L', :'service_a'),
  '42501', 'customer cannot UPDATE shop_services price');

-- Cross-tenant: owner_b tries to tamper with shop_a data
select set_config('request.jwt.claim.sub', :'owner_b', false);

select qassa_test.throws(
  format('update public.shop_services set price_tnd = 0 where id = %L', :'service_a'),
  '42501', 'owner_b cannot UPDATE shop_a services (cross-tenant)');

select qassa_test.throws(
  format('update public.barbers set display_name = %L where id = %L', 'x', :'barber_a1'),
  '42501', 'owner_b cannot UPDATE shop_a barbers (cross-tenant)');

-- Cross-tenant appointment read isolation: owner_b sees zero appointments for shop_a
select qassa_test.ok(
  (select count(*) from public.appointments where shop_id = :'shop_a') = 0,
  'owner_b reads zero appointments from shop_a (RLS tenant isolation)');

reset role;

-- ── B. RLS — public_barbershops view is read-only ────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select qassa_test.throws(
  format('update public.public_barbershops set name = %L where id = %L', 'hacked', :'shop_a'),
  '42501', 'customer cannot UPDATE public_barbershops view');

select qassa_test.throws(
  format('delete from public.public_barbershops where id = %L', :'shop_a'),
  '42501', 'customer cannot DELETE from public_barbershops view');

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

-- ── F. Booking — cross-tenant data reads ────────────────────────────────────

set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_b', false);

select qassa_test.ok(
  (select count(*) from public.shop_services where shop_id = :'shop_a') = 0,
  'owner_b reads zero shop_services for shop_a (RLS blocks cross-tenant service read)');

select qassa_test.ok(
  (select count(*) from public.barbers where shop_id = :'shop_a') = 0,
  'owner_b reads zero barbers for shop_a (RLS blocks cross-tenant barber read)');

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

-- Restore so subsequent tests are not affected.
reset role;
update public.barbershops set is_published = true where id = :'shop_a';

reset role;
