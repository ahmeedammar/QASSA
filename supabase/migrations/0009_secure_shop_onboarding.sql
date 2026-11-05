-- 0009 — Atomically provision shops and their owner memberships.

create or replace function public.create_owned_shop(
  p_name text,
  p_slug text,
  p_city text default null,
  p_address text default null,
  p_phone text default null,
  p_description text default null,
  p_template_id text default 'classic_gentleman'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_shop_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required.'
      using errcode = '28000';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120
    or p_slug is null
    or p_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'
    or p_template_id is null
    or p_template_id not in (
      'royal_gold', 'urban_cut', 'classic_gentleman',
      'minimal_studio', 'dark_prestige'
    )
    or (p_city is not null and char_length(btrim(p_city)) > 120)
    or (p_address is not null and char_length(btrim(p_address)) > 240)
    or (p_phone is not null and char_length(btrim(p_phone)) > 40)
    or (p_description is not null and char_length(btrim(p_description)) > 2000)
  then
    raise exception 'Shop details are invalid.'
      using errcode = '22023';
  end if;

  insert into public.barbershops (
    owner_id, name, slug, city, address, phone, description, template_id
  ) values (
    v_user_id,
    btrim(p_name),
    p_slug,
    nullif(btrim(p_city), ''),
    nullif(btrim(p_address), ''),
    nullif(btrim(p_phone), ''),
    nullif(btrim(p_description), ''),
    p_template_id
  )
  returning id into v_shop_id;

  insert into public.shop_members (shop_id, user_id, role)
  values (v_shop_id, v_user_id, 'owner');

  insert into public.shop_settings (shop_id)
  values (v_shop_id);

  insert into public.user_roles (user_id, role)
  values (v_user_id, 'owner')
  on conflict (user_id, role) do nothing;

  return v_shop_id;
end;
$$;

revoke execute on function public.create_owned_shop(
  text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_owned_shop(
  text, text, text, text, text, text, text
) to authenticated;

create or replace function public.list_my_shops()
returns table (
  id uuid,
  name text,
  slug text,
  city text,
  template_id text,
  is_published boolean,
  is_suspended boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select shop.id, shop.name, shop.slug, shop.city, shop.template_id,
    shop.is_published, shop.is_suspended
  from public.barbershops shop
  where auth.uid() is not null
    and (
      shop.owner_id = auth.uid()
      or exists (
        select 1 from public.shop_members member
        where member.shop_id = shop.id
          and member.user_id = auth.uid()
          and member.is_active
      )
    )
  order by shop.created_at;
$$;

revoke execute on function public.list_my_shops() from public, anon;
grant execute on function public.list_my_shops() to authenticated;

create policy barbershops_member_select on public.barbershops
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_shop_member(id)
  );
