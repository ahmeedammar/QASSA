-- 0003 — Tenancy: barbershops, shop_members, shop_settings (+ RLS)

create table public.barbershops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  city text,
  address text,
  phone text,
  description text,
  logo_path text,
  template_id text not null default 'classic_gentleman' check (template_id in (
    'royal_gold', 'urban_cut', 'classic_gentleman',
    'minimal_studio', 'dark_prestige'
  )),
  is_published boolean not null default false,
  is_suspended boolean not null default false,
  suspension_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger barbershops_updated_at
  before update on public.barbershops
  for each row execute function public.set_updated_at();

create index barbershops_slug_idx on public.barbershops(slug);
create index barbershops_city_idx on public.barbershops(city) where is_published and not is_suspended;

create table public.shop_members (
  shop_id uuid not null references public.barbershops(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'barber')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index shop_members_user_idx on public.shop_members(user_id) where is_active;

create table public.shop_settings (
  shop_id uuid primary key references public.barbershops(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger shop_settings_updated_at
  before update on public.shop_settings
  for each row execute function public.set_updated_at();

-- Tenant membership check. Membership is always derived from the
-- authenticated user's server-verified records — never from browser input.
create or replace function public.is_shop_member(p_shop_id uuid, p_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shop_members sm
    where sm.shop_id = p_shop_id
      and sm.user_id = auth.uid()
      and sm.is_active
      and (p_roles is null or sm.role = any(p_roles))
  );
$$;

revoke execute on function public.is_shop_member(uuid, text[]) from public, anon;
grant execute on function public.is_shop_member(uuid, text[]) to authenticated;

-- ── RLS ──
alter table public.barbershops enable row level security;
alter table public.shop_members enable row level security;
alter table public.shop_settings enable row level security;

-- Public marketplace sees only intentionally public, non-suspended shops.
create policy barbershops_public_read on public.barbershops
  for select to anon, authenticated
  using (is_published and not is_suspended);

-- Members with owner/manager roles manage their own shop's record.
create policy barbershops_member_update on public.barbershops
  for update to authenticated
  using (public.is_shop_member(id, '{owner,manager}'))
  with check (public.is_shop_member(id, '{owner,manager}'));

create policy barbershops_owner_insert on public.barbershops
  for insert to authenticated
  with check (owner_id = auth.uid());

-- Platform admins can read all shops (operations/support/finance scopes).
create policy barbershops_admin_read on public.barbershops
  for select to authenticated
  using (public.is_platform_admin());

-- A member sees only their own memberships; admins see all.
create policy shop_members_select on public.shop_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_shop_member(shop_id, '{owner,manager}')
    or public.is_platform_admin()
  );

-- Membership changes go through server-verified actions (service role).
-- No authenticated insert/update/delete policy by design.

-- Shop settings are private to owner/manager members.
create policy shop_settings_member_all on public.shop_settings
  for all to authenticated
  using (public.is_shop_member(shop_id, '{owner,manager}'))
  with check (public.is_shop_member(shop_id, '{owner,manager}'));
