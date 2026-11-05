-- 0002 — Identity: profiles, user_roles, platform_admins (+ RLS)

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_path text,
  locale text not null default 'fr' check (locale in ('ar', 'fr', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Application roles (customer / owner / employee). This is NOT the
-- administrative model — platform admins live in platform_admins below.
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('customer', 'owner', 'employee')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Dedicated platform administrator authorization model.
-- Bootstrap (initial platform owner) is done through the controlled seed
-- script only. There is no self-promotion path anywhere in the app.
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null check (role in (
    'platform_owner', 'super_admin', 'support_admin',
    'finance_admin', 'operations_admin'
  )),
  permissions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.platform_admins(id),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index platform_admins_user_idx on public.platform_admins(user_id);

-- Security-definer helpers. RLS policies never trust client-supplied claims.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins pa
    where pa.user_id = auth.uid() and pa.is_active
  );
$$;

-- Throttled activity timestamp; callable only for the admin's own record.
create or replace function public.touch_admin_last_used()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.platform_admins
  set last_used_at = now()
  where user_id = auth.uid() and is_active;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'locale', 'fr')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── RLS ──
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.platform_admins enable row level security;

-- profiles: a user reads and updates only their own profile.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_roles: read your own roles only. Writes happen via service role or
-- trigger — there is intentionally no authenticated insert/update/delete.
create policy user_roles_select_own on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- platform_admins: readable by active platform admins only.
-- Inserts/updates/deletes only via service role after requireAdmin() checks.
create policy platform_admins_select on public.platform_admins
  for select to authenticated
  using (public.is_platform_admin());

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

revoke execute on function public.touch_admin_last_used() from public, anon;
grant execute on function public.touch_admin_last_used() to authenticated;
