-- 0013 - Customer cancellation closes when the appointment starts.
-- Authorization is unchanged from 0008: the caller must be authenticated, the
-- appointment must be confirmed, and only the customer or an owner/manager of
-- that shop can cancel. Managers keep the existing ability to cancel after
-- start; customers who are not managers of that shop cannot.

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
  if v_appointment.customer_id = v_user_id
    and v_appointment.starts_at <= now()
    and not public.is_shop_member(v_appointment.shop_id, '{owner,manager}')
  then
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
