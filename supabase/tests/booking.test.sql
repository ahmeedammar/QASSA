-- Database-backed tests for booking, idempotency, tenant isolation, manager
-- actions and the customer cancellation cutoff (0013). Runs after fixtures.sql
-- in the same psql session, as the real anon/authenticated API roles.

reset role;
select ((:'day_d'::date + time '10:00') at time zone 'Africa/Tunis') as slot_1000,
       ((:'day_d'::date + time '10:05') at time zone 'Africa/Tunis') as slot_1005,
       ((:'day_d'::date + time '10:15') at time zone 'Africa/Tunis') as slot_1015,
       ((:'day_d'::date + time '10:30') at time zone 'Africa/Tunis') as slot_1030,
       ((:'day_d'::date + time '10:45') at time zone 'Africa/Tunis') as slot_1045,
       ((:'day_d'::date + time '12:15') at time zone 'Africa/Tunis') as slot_1215,
       ((:'day_d'::date + time '12:30') at time zone 'Africa/Tunis') as slot_1230,
       ((:'day_d'::date + time '14:00') at time zone 'Africa/Tunis') as slot_1400,
       ((:'day_rest'::date + time '10:00') at time zone 'Africa/Tunis') as slot_rest,
       (((now() at time zone 'Africa/Tunis')::date + 61 + time '10:00')
         at time zone 'Africa/Tunis') as slot_too_far,
       (((now() at time zone 'Africa/Tunis')::date - 1 + time '10:00')
         at time zone 'Africa/Tunis') as slot_past
\gset
select gen_random_uuid() as key_1, gen_random_uuid() as key_2,
       gen_random_uuid() as key_3, gen_random_uuid() as key_4 \gset

-- ── Availability (public) ──────────────────────────────────────────────
set role anon;
select set_config('request.jwt.claim.sub', '', false);

-- 09:00–18:15 on a 15-minute grid is 38 starts; the 13:00–14:00 break
-- removes the 6 starts whose 40-minute occupancy overlaps it.
select qassa_test.ok(
  (select count(*) from public.get_available_slots(:'shop_a', :'barber_a1', :'service_a', :'day_d')) = 32,
  'anon sees 32 open slots for an empty day, excluding the break');
select qassa_test.ok(
  not exists (select 1 from public.get_available_slots(:'shop_a', :'barber_a1', :'service_a', :'day_d')
              where slot_start = :'slot_1230'),
  'slot whose occupancy overlaps the break is hidden');
select qassa_test.ok(
  exists (select 1 from public.get_available_slots(:'shop_a', :'barber_a1', :'service_a', :'day_d')
          where slot_start = :'slot_1215')
  and exists (select 1 from public.get_available_slots(:'shop_a', :'barber_a1', :'service_a', :'day_d')
              where slot_start = :'slot_1400'),
  'slots just before and after the break remain open');
select qassa_test.ok(
  (select count(*) from public.get_available_slots(:'shop_a', :'barber_a1', :'service_a', :'day_rest')) = 0,
  'the weekly rest day has no slots');
select qassa_test.ok(
  (extract(dow from :'day_rest'::date)::int = :'rest_day'::int)
  and not exists (
    select 1 from public.shop_business_hours
    where shop_id = :'shop_a' and weekday = :'rest_day'::int
  ),
  'a rest day carries no opening hours');
select qassa_test.ok(
  (select count(*) from public.get_available_slots(:'shop_a', :'barber_a2', :'service_a', :'day_d')) = 0,
  'barber without the service assignment or schedule has no slots');
select qassa_test.ok(
  (select count(*) from public.get_available_slots(:'shop_a', :'barber_b', :'service_a', :'day_d')) = 0,
  'another tenant''s barber cannot be combined with this shop''s service');

select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1000', :'key_1'),
  '42501', 'anon cannot execute book_appointment');
select qassa_test.throws(
  format('select public.cancel_appointment(%L)', gen_random_uuid()),
  '42501', 'anon cannot execute cancel_appointment');
select qassa_test.throws(
  format('select public.manage_shop_appointment(%L, %L)', gen_random_uuid(), 'cancelled'),
  '42501', 'anon cannot execute manage_shop_appointment');
select qassa_test.ok(
  (select count(*) from public.appointments) = 0,
  'anon reads no appointments');

-- ── Booking as customer 1 ──────────────────────────────────────────────
set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);

select public.book_appointment(:'shop_a', :'barber_a1', :'service_a', :'slot_1000', :'key_1')
  as appt_1 \gset
select qassa_test.ok(:'appt_1' is not null, 'customer books an open slot');
select qassa_test.ok(
  (select occupied_until - starts_at from public.appointments where id = :'appt_1') = interval '40 minutes'
  and (select ends_at - starts_at from public.appointments where id = :'appt_1') = interval '30 minutes',
  'occupancy includes the service buffer, ends_at excludes it');
select qassa_test.ok(
  (select price_tnd from public.appointment_services where appointment_id = :'appt_1') = 25.000
  and (select service_name from public.appointment_services where appointment_id = :'appt_1') = 'Coupe',
  'service name and price are snapshotted on the appointment');

select qassa_test.ok(
  public.book_appointment(:'shop_a', :'barber_a1', :'service_a', :'slot_1000', :'key_1') = :'appt_1',
  'repeating the same idempotency key returns the original appointment');
select qassa_test.ok(
  (select count(*) from public.appointments where customer_id = :'customer_1') = 1,
  'idempotent retry does not create a duplicate');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1400', :'key_1'),
  '22023', 'reusing an idempotency key for a different time is rejected');

select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1005', gen_random_uuid()),
  'P0001', 'off-grid start time is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_past', gen_random_uuid()),
  'P0001', 'past start time is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_too_far', gen_random_uuid()),
  'P0001', 'start time beyond the 60-day window is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_rest', gen_random_uuid()),
  'P0001', 'rest day start time is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1230', gen_random_uuid()),
  'P0001', 'start time overlapping the barber break is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a_other', :'slot_1400', gen_random_uuid()),
  '22023', 'service the barber does not offer is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_b', :'service_a', :'slot_1400', gen_random_uuid()),
  '22023', 'cross-tenant barber is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_b', :'barber_a1', :'service_a', :'slot_1400', gen_random_uuid()),
  '22023', 'cross-tenant shop/service combination is rejected');

select qassa_test.throws(
  format('insert into public.appointments (shop_id, customer_id, barber_id, idempotency_key, starts_at, ends_at, occupied_until) values (%L, %L, %L, %L, %L, %L, %L)',
    :'shop_a', :'customer_1', :'barber_a1', gen_random_uuid(), :'slot_1400', :'slot_1400', :'slot_1400'),
  '42501', 'customers cannot insert appointments directly');
select qassa_test.throws(
  format('update public.appointments set status = %L where id = %L', 'cancelled', :'appt_1'),
  '42501', 'customers cannot update appointments directly');

-- ── Slot conflicts as customer 2 ───────────────────────────────────────
select set_config('request.jwt.claim.sub', :'customer_2', false);

select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1000', :'key_2'),
  'P0001', 'second customer cannot take the same slot');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1015', :'key_2'),
  'P0001', 'overlapping start time is rejected');
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_a', :'barber_a1', :'service_a', :'slot_1030', :'key_2'),
  'P0001', 'start inside the previous appointment''s buffer is rejected');
select qassa_test.ok(
  public.book_appointment(:'shop_a', :'barber_a1', :'service_a', :'slot_1045', :'key_2') is not null,
  'start right after the previous buffer is accepted');
select qassa_test.ok(
  (select count(*) from public.get_available_slots(:'shop_a', :'barber_a1', :'service_a', :'day_d')) = 32 - 5 - 3,
  'booked occupancy is removed from availability');
select qassa_test.ok(
  (select count(*) from public.appointments where customer_id = :'customer_1') = 0,
  'customer 2 cannot read customer 1''s appointments');
select qassa_test.ok(
  public.cancel_appointment(:'appt_1') = false
  and (select status from public.appointments where id = :'appt_1') is null,
  'customer 2 cannot cancel customer 1''s appointment');

-- ── Tenant isolation for staff ─────────────────────────────────────────
select set_config('request.jwt.claim.sub', :'owner_b', false);
select qassa_test.ok(
  (select count(*) from public.appointments where shop_id = :'shop_a') = 0,
  'other shop owner cannot read shop A appointments');
select qassa_test.ok(public.cancel_appointment(:'appt_1') = false,
  'other shop owner cannot cancel shop A appointments');
select qassa_test.ok(public.manage_shop_appointment(:'appt_1', 'cancelled') = false,
  'other shop owner cannot manage shop A appointments');

select set_config('request.jwt.claim.sub', :'staff_barber_a', false);
select qassa_test.ok(
  (select count(*) from public.appointments where shop_id = :'shop_a') = 2,
  'barber-role staff can read their shop''s calendar');
select qassa_test.ok(public.cancel_appointment(:'appt_1') = false,
  'barber-role staff cannot cancel customer appointments');
select qassa_test.ok(public.manage_shop_appointment(:'appt_1', 'cancelled') = false,
  'barber-role staff cannot manage appointment status');

-- ── Cancellation and rebooking ─────────────────────────────────────────
select set_config('request.jwt.claim.sub', :'customer_1', false);
select qassa_test.throws(
  format('select public.cancel_appointment(%L, %L)', :'appt_1', repeat('x', 251)),
  '22023', 'over-long cancellation reason is rejected');
select qassa_test.ok(public.cancel_appointment(:'appt_1', 'Change of plans') = true,
  'customer cancels their own future appointment');
select qassa_test.ok(
  (select status from public.appointments where id = :'appt_1') = 'cancelled'
  and (select cancellation_reason from public.appointments where id = :'appt_1') = 'Change of plans',
  'cancellation status and reason are stored');
select qassa_test.ok(public.cancel_appointment(:'appt_1') = false,
  'cancelling twice is a no-op');

select set_config('request.jwt.claim.sub', :'customer_2', false);
select qassa_test.ok(
  public.book_appointment(:'shop_a', :'barber_a1', :'service_a', :'slot_1000', :'key_3') is not null,
  'cancelled slot can be rebooked immediately by another customer');

-- ── Suspended shop ─────────────────────────────────────────────────────
reset role;
select pg_catalog.set_config('qassa.allow_shop_suspension', 'on', false);
update public.barbershops set is_suspended = true where id = :'shop_b';
select pg_catalog.set_config('qassa.allow_shop_suspension', '', false);
set role authenticated;
select qassa_test.throws(
  format('select public.book_appointment(%L, %L, %L, %L, %L)',
    :'shop_b', :'barber_b', :'service_b', :'slot_1000', :'key_4'),
  'P0001', 'suspended shop cannot be booked');
reset role;
select pg_catalog.set_config('qassa.allow_shop_suspension', 'on', false);
update public.barbershops set is_suspended = false where id = :'shop_b';
select pg_catalog.set_config('qassa.allow_shop_suspension', '', false);

-- ── Started and ended appointments (0013 cutoff, 0012 manager actions) ──
-- Inserted directly by the superuser because the API never books the past.
insert into public.appointments
  (shop_id, customer_id, barber_id, idempotency_key, starts_at, ends_at, occupied_until)
values
  (:'shop_a', :'customer_1', :'barber_a1', gen_random_uuid(),
   now() - interval '10 minutes', now() + interval '20 minutes', now() + interval '30 minutes')
returning id as appt_started \gset
insert into public.appointments
  (shop_id, customer_id, barber_id, idempotency_key, starts_at, ends_at, occupied_until)
values
  (:'shop_a', :'customer_1', :'barber_a1', gen_random_uuid(),
   now() - interval '3 hours', now() - interval '150 minutes', now() - interval '140 minutes')
returning id as appt_ended \gset
insert into public.appointments
  (shop_id, customer_id, barber_id, idempotency_key, starts_at, ends_at, occupied_until)
values
  (:'shop_a', :'customer_1', :'barber_a1', gen_random_uuid(),
   now() - interval '6 hours', now() - interval '330 minutes', now() - interval '320 minutes')
returning id as appt_ended_2 \gset

set role authenticated;
select set_config('request.jwt.claim.sub', :'customer_1', false);
select qassa_test.ok(public.cancel_appointment(:'appt_started') = false,
  'customer cannot cancel once the appointment has started');
select qassa_test.ok(public.cancel_appointment(:'appt_ended') = false,
  'customer cannot cancel a past appointment');
select qassa_test.ok(
  (select status from public.appointments where id = :'appt_started') = 'confirmed',
  'refused customer cancellation leaves the appointment confirmed');
select qassa_test.ok(public.manage_shop_appointment(:'appt_ended', 'completed') = false,
  'customers cannot use the manager status action');

select set_config('request.jwt.claim.sub', :'manager_a', false);
select qassa_test.throws(
  format('select public.manage_shop_appointment(%L, %L)', :'appt_started', 'completed'),
  '22023', 'manager cannot complete an appointment that has not ended');
select qassa_test.throws(
  format('select public.manage_shop_appointment(%L, %L)', :'appt_ended', 'confirmed'),
  '22023', 'manager cannot set an unsupported status');
select qassa_test.ok(public.manage_shop_appointment(:'appt_ended', 'no_show') = true,
  'manager marks an ended appointment as no-show');
select qassa_test.ok(public.manage_shop_appointment(:'appt_ended', 'completed') = false,
  'non-confirmed appointment cannot change status again');
select qassa_test.ok(public.cancel_appointment(:'appt_started', 'Barber unavailable') = true,
  'manager can still cancel a started appointment');

select set_config('request.jwt.claim.sub', :'owner_a', false);
select qassa_test.ok(public.manage_shop_appointment(:'appt_ended_2', 'completed') = true,
  'owner completes an ended appointment');
select qassa_test.ok(
  (select status from public.appointments where id = :'appt_ended_2') = 'completed'
  and (select cancellation_reason from public.appointments where id = :'appt_ended_2') is null,
  'completed appointment has no cancellation reason');

-- An owner who also books as a customer keeps manager rights on started appointments.
reset role;
insert into public.appointments
  (shop_id, customer_id, barber_id, idempotency_key, starts_at, ends_at, occupied_until)
values
  (:'shop_b', :'owner_a', :'barber_b', gen_random_uuid(),
   now() - interval '5 minutes', now() + interval '25 minutes', now() + interval '25 minutes')
returning id as appt_owner_customer \gset
set role authenticated;
select set_config('request.jwt.claim.sub', :'owner_a', false);
select qassa_test.ok(public.cancel_appointment(:'appt_owner_customer') = false,
  'owner of shop A is only a customer at shop B and hits the cutoff there');

reset role;
