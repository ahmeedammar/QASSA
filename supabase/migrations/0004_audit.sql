-- 0004 — Append-only administrative audit trail

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  resource_type text,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  success boolean not null default true,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs(action, created_at desc);
create index audit_logs_created_idx on public.audit_logs(created_at desc);

-- Single write path: security-definer function. The application role has no
-- direct INSERT grant, no UPDATE and no DELETE path — administrators cannot
-- silently erase their own activity.
create or replace function public.log_audit_event(
  p_action text,
  p_resource_type text default null,
  p_resource_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_success boolean default true
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id bigint;
  v_actor_id uuid := auth.uid();
  v_role text;
begin
  if v_actor_id is null then
    raise exception 'Authentication required to record an audit event.'
      using errcode = 'insufficient_privilege';
  end if;

  select pa.role into v_role
  from public.platform_admins pa
  where pa.user_id = v_actor_id and pa.is_active
  limit 1;

  if v_role is null
    and not (p_action = 'admin.access_denied' and not coalesce(p_success, true))
  then
    raise exception 'Active administrator required to record this audit event.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into public.audit_logs (
    actor_id, actor_role, action, resource_type, resource_id, metadata, success
  ) values (
    v_actor_id, v_role, p_action, p_resource_type, p_resource_id,
    coalesce(p_metadata, '{}'::jsonb), coalesce(p_success, true)
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.audit_logs enable row level security;

-- Readable by active platform admins only; never by shop owners or customers.
create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated
  using (public.is_platform_admin());

revoke execute on function public.log_audit_event(text, text, text, jsonb, boolean)
  from public, anon;
grant execute on function public.log_audit_event(text, text, text, jsonb, boolean)
  to authenticated;
