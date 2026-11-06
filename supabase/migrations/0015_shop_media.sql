-- 0015 — Storefront media: cover, logo, gallery and barber photos.
--
-- Images live in the public "shop-media" Storage bucket under
-- {shop_id}/{kind}/{random uuid}.{ext}. Only the object path is stored in the
-- database, so a shop can never point at another shop's folder: the trigger
-- below re-validates every path against the row's own shop id, and the Storage
-- policies re-check membership against the first folder segment.

-- ── columns ──
-- barbershops.logo_path and barbers.avatar_path already exist (0003, 0005)
-- and were never exposed to the application.
alter table public.barbershops
  add column if not exists cover_path text,
  add column if not exists gallery_paths text[] not null default '{}';

-- ── path validation ──
create or replace function public.shop_media_path_is_valid(
  p_shop_id uuid,
  p_path text
)
returns boolean
language sql
immutable
as $$
  select p_path ~ (
    '^' || p_shop_id::text ||
    '/(logo|cover|gallery|avatar)/' ||
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' ||
    '\.(webp|jpg|jpeg|png|avif)$'
  );
$$;

revoke execute on function public.shop_media_path_is_valid(uuid, text)
  from public, anon;
grant execute on function public.shop_media_path_is_valid(uuid, text)
  to authenticated;

create or replace function public.guard_shop_media_paths()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text;
begin
  if new.logo_path is not null
     and not public.shop_media_path_is_valid(new.id, new.logo_path) then
    raise exception 'Shop logo path is invalid.' using errcode = '22023';
  end if;

  if new.cover_path is not null
     and not public.shop_media_path_is_valid(new.id, new.cover_path) then
    raise exception 'Shop cover path is invalid.' using errcode = '22023';
  end if;

  if new.gallery_paths is null then
    new.gallery_paths := '{}';
  end if;

  if cardinality(new.gallery_paths) > 12 then
    raise exception 'A shop may attach at most 12 gallery images.'
      using errcode = '22023';
  end if;

  foreach v_path in array new.gallery_paths loop
    if not public.shop_media_path_is_valid(new.id, v_path) then
      raise exception 'Shop gallery path is invalid.' using errcode = '22023';
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists barbershops_media_paths_guard on public.barbershops;
create trigger barbershops_media_paths_guard
  before insert or update of logo_path, cover_path, gallery_paths
  on public.barbershops
  for each row execute function public.guard_shop_media_paths();

create or replace function public.guard_barber_media_paths()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.avatar_path is not null
     and not public.shop_media_path_is_valid(new.shop_id, new.avatar_path) then
    raise exception 'Barber photo path is invalid.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists barbers_media_paths_guard on public.barbers;
create trigger barbers_media_paths_guard
  before insert or update of avatar_path
  on public.barbers
  for each row execute function public.guard_barber_media_paths();

-- ── media write RPC ──
create or replace function public.update_shop_media(
  p_shop_id uuid,
  p_logo_path text default null,
  p_cover_path text default null,
  p_gallery_paths text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gallery text[];
begin
  if p_shop_id is null then
    raise exception 'A valid shop is required.' using errcode = '22023';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;
  if not public.is_shop_member(p_shop_id, '{owner,manager}') then
    raise exception 'Shop manager access required.' using errcode = '42501';
  end if;

  -- De-duplicate while preserving the owner's chosen order.
  select coalesce(array_agg(item order by first_seen), '{}')
    into v_gallery
  from (
    select path as item, min(ordinality) as first_seen
    from unnest(coalesce(p_gallery_paths, '{}'))
      with ordinality as media(path, ordinality)
    group by path
  ) deduped;

  update public.barbershops
  set logo_path = nullif(btrim(coalesce(p_logo_path, '')), ''),
      cover_path = nullif(btrim(coalesce(p_cover_path, '')), ''),
      gallery_paths = v_gallery
  where id = p_shop_id;

  if not found then
    raise exception 'Shop not found.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.update_shop_media(uuid, text, text, text[])
  from public, anon;
grant execute on function public.update_shop_media(uuid, text, text, text[])
  to authenticated;

-- ── publishing readiness now expects a real gallery ──
create or replace function public.shop_website_missing_requirements(
  p_shop_id uuid
)
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_missing text[];
begin
  if auth.uid() is null
    or not public.is_shop_member(p_shop_id, '{owner,manager}')
  then
    raise exception 'Shop manager access required.'
      using errcode = '42501';
  end if;

  select array_remove(array[
    case when not exists (
      select 1 from public.shop_services service
      where service.shop_id = p_shop_id
        and service.is_active
    ) then 'services' end,
    case when not exists (
      select 1
      from public.barbers barber
      join public.barber_services assignment
        on assignment.shop_id = barber.shop_id
        and assignment.barber_id = barber.id
      join public.shop_services service
        on service.shop_id = assignment.shop_id
        and service.id = assignment.service_id
      where barber.shop_id = p_shop_id
        and barber.is_active
        and service.is_active
    ) then 'barber_services' end,
    case when not exists (
      select 1 from public.shop_business_hours hours
      where hours.shop_id = p_shop_id
    ) then 'shop_hours' end,
    case when not exists (
      select 1
      from public.barber_schedules schedule
      join public.barbers barber
        on barber.shop_id = schedule.shop_id
        and barber.id = schedule.barber_id
        and barber.is_active
      where schedule.shop_id = p_shop_id
    ) then 'barber_schedules' end,
    case when coalesce(cardinality(shop.gallery_paths), 0) < 3 then
      'shop_media'
    end
  ], null) into v_missing
  from public.barbershops shop
  where shop.id = p_shop_id;

  return coalesce(v_missing, '{}');
end;
$$;

revoke execute on function public.shop_website_missing_requirements(uuid)
  from public, anon;
grant execute on function public.shop_website_missing_requirements(uuid)
  to authenticated;

-- ── Storage bucket ──
-- Public read keeps next/image and the CDN working without signed URLs; the
-- random uuid filename is what keeps draft assets unguessable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-media',
  'shop-media',
  true,
  5242880,
  array['image/webp', 'image/jpeg', 'image/png', 'image/avif']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_shop_media(p_folder text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shop_id uuid;
begin
  if auth.uid() is null or p_folder is null then
    return false;
  end if;
  begin
    v_shop_id := p_folder::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.is_shop_member(v_shop_id, '{owner,manager}');
end;
$$;

revoke execute on function public.can_manage_shop_media(text)
  from public, anon;
grant execute on function public.can_manage_shop_media(text)
  to authenticated;

drop policy if exists shop_media_member_insert on storage.objects;
create policy shop_media_member_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'shop-media'
    and public.can_manage_shop_media((storage.foldername(name))[1])
  );

drop policy if exists shop_media_member_update on storage.objects;
create policy shop_media_member_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'shop-media'
    and public.can_manage_shop_media((storage.foldername(name))[1])
  )
  with check (
    bucket_id = 'shop-media'
    and public.can_manage_shop_media((storage.foldername(name))[1])
  );

drop policy if exists shop_media_member_delete on storage.objects;
create policy shop_media_member_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'shop-media'
    and public.can_manage_shop_media((storage.foldername(name))[1])
  );

-- The bucket is public, so listing it adds no exposure beyond the object URLs
-- themselves, and the Studio needs to read back what it just uploaded.
drop policy if exists shop_media_public_read on storage.objects;
create policy shop_media_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'shop-media');

-- ── public read surface ──
grant select (logo_path, cover_path, gallery_paths)
  on public.barbershops to anon, authenticated;

create or replace view public.public_barbershops
with (security_invoker = true)
as
select
  id,
  name,
  slug,
  city,
  address,
  phone,
  description,
  template_id,
  logo_path,
  cover_path,
  gallery_paths
from public.barbershops
where is_published and not is_suspended;

grant select on public.public_barbershops to anon, authenticated;
