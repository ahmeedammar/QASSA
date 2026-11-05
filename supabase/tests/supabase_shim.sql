-- Minimal stand-in for the Supabase platform objects the migrations depend on.
-- ONLY for disposable local PostgreSQL clusters (see scripts/db-test.mjs).
-- Never run against a Supabase project: it would collide with the real auth schema.

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    raise exception 'auth schema already exists - refusing to run shim on a real Supabase database';
  end if;
end;
$$;

-- Roles are cluster-wide, so they may survive from a previous scratch database.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated, service_role;
-- Supabase grants function execution to API roles by default; migrations must revoke it.
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

-- Mirrors Supabase: identity comes from the JWT claims PostgREST sets per request.
create function auth.uid() returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create function auth.role() returns text
language sql stable
as $$
  select auth.jwt() ->> 'role';
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;
