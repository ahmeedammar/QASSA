-- Database-backed tests for QASSA Control shop listing and suspension (0014).
-- Runs after fixtures.sql in the same psql session.

reset role;

select qassa_test.throws(
  format('select public.list_platform_shops()'),
  '42501', 'anon cannot execute list_platform_shops');
select qassa_test.throws(
  format('select public.set_shop_suspension(%L, true, %L)', :'shop_a', 'policy'),
  '42501', 'anon cannot execute set_shop_suspension');

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);
select qassa_test.throws(
  format('select * from public.list_platform_shops()'),
  '42501', 'customers cannot list platform shops');
select qassa_test.throws(
  format('select public.set_shop_suspension(%L, true, %L)', :'shop_a', 'policy'),
  '42501', 'customers cannot suspend shops');

select set_config('request.jwt.claim.sub', :'owner_a', false);
select qassa_test.throws(
  format('update public.barbershops set is_suspended = true where id = %L', :'shop_a'),
  '42501', 'shop owners cannot toggle suspension directly');
select qassa_test.throws(
  format('update public.barbershops set suspension_reason = %L where id = %L', 'self', :'shop_a'),
  '42501', 'shop owners cannot set a suspension reason');

-- suspension_reason is intentionally outside the 0007 column grant, so a shop
-- member cannot even read it; verify the outcome through the superuser instead.
select qassa_test.throws(
  'select suspension_reason from public.barbershops limit 0',
  '42501', 'shop owners cannot read the suspension reason column');

reset role;
select qassa_test.ok(
  (select not is_suspended and suspension_reason is null from public.barbershops where id = :'shop_a'),
  'refused owner updates leave the shop unsuspended');
set role authenticated;

select set_config('request.jwt.claim.sub', :'support_admin', false);
select qassa_test.ok(
  (select count(*) from public.list_platform_shops()) = 2,
  'support admin can list every shop, including drafts and private fields');
select qassa_test.throws(
  format('select public.set_shop_suspension(%L, true, %L)', :'shop_a', 'policy'),
  '42501', 'support admin cannot suspend shops');

select set_config('request.jwt.claim.sub', :'finance_admin', false);
select qassa_test.throws(
  format('select public.set_shop_suspension(%L, true, %L)', :'shop_a', 'policy'),
  '42501', 'finance admin cannot suspend shops');

select set_config('request.jwt.claim.sub', :'ops_admin', false);
select qassa_test.throws(
  format('select public.set_shop_suspension(%L, true, %L)', :'shop_a', repeat('x', 251)),
  '22023', 'over-long suspension reason is rejected');
select qassa_test.ok(
  public.set_shop_suspension(:'shop_a', true, '  Policy violation  ') = true,
  'operations admin suspends a shop');
-- Admins see these private columns through the definer RPC; 0007 deliberately
-- never grants suspension_reason on the bare table to any API role.
select qassa_test.ok(
  (select is_suspended and suspension_reason = 'Policy violation'
     from public.list_platform_shops() where id = :'shop_a'),
  'suspension flag and trimmed reason are stored');
select qassa_test.ok(
  not exists (select 1 from public.public_barbershops where id = :'shop_a'),
  'a suspended shop disappears from the public directory');

select set_config('request.jwt.claim.sub', :'customer_1', false);
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1400', gen_random_uuid()),
  'P0001', 'suspended shops cannot be booked');

select set_config('request.jwt.claim.sub', :'owner_a', false);
select qassa_test.throws(
  format('select public.set_shop_published(%L, true)', :'shop_a'),
  'P0002', 'owners cannot republish a suspended shop');

select set_config('request.jwt.claim.sub', :'ops_admin', false);
select qassa_test.ok(
  public.set_shop_suspension(:'shop_a', false, 'ignored') = true,
  'operations admin restores the shop');
select qassa_test.ok(
  (select not is_suspended and suspension_reason is null
     from public.list_platform_shops() where id = :'shop_a'),
  'restoring a shop clears the suspension reason');
select qassa_test.ok(
  exists (select 1 from public.public_barbershops where id = :'shop_a'),
  'a restored published shop returns to the public directory');

select qassa_test.ok(
  public.set_shop_suspension(gen_random_uuid(), true, 'missing') = false,
  'suspending an unknown shop is a no-op');

reset role;
