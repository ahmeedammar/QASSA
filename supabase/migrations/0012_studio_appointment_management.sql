-- 0012 — Shop-manager appointment status changes.

create or replace function public.manage_shop_appointment(
  p_appointment_id uuid,
  p_status text,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appointment public.appointments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;
  if p_appointment_id is null
    or p_status is null
    or p_status not in ('cancelled', 'completed', 'no_show')
    or (p_reason is not null and char_length(btrim(p_reason)) > 250)
  then
    raise exception 'Appointment update is invalid.'
      using errcode = '22023';
  end if;

  select appointment.* into v_appointment
  from public.appointments appointment
  where appointment.id = p_appointment_id
    and public.is_shop_member(
      appointment.shop_id,
      '{owner,manager}'
    )
  for update;

  if not found or v_appointment.status <> 'confirmed' then
    return false;
  end if;
  if p_status in ('completed', 'no_show')
    and v_appointment.ends_at > now()
  then
    raise exception 'Only ended appointments can be completed or marked no-show.'
      using errcode = '22023';
  end if;

  update public.appointments
  set status = p_status,
      cancellation_reason = case
        when p_status = 'cancelled' then nullif(btrim(p_reason), '')
        else null
      end
  where id = p_appointment_id;

  return true;
end;
$$;

revoke execute on function public.manage_shop_appointment(uuid, text, text)
  from public, anon;
grant execute on function public.manage_shop_appointment(uuid, text, text)
  to authenticated;
