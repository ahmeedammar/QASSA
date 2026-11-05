-- Controlled bootstrap of the initial platform owner.
--
-- This is the ONLY supported way to create the first administrator.
-- Run manually against the target Supabase project (never from the app):
--
--   1. Create the founder's auth user first (Supabase Dashboard →
--      Authentication → Add user, or `supabase` CLI). Confirm the email.
--   2. Replace the email below and run this script (SQL editor or psql).
--
-- After bootstrap, all further admin grants go through QASSA Control with
-- MFA + recent-auth enforcement, performed by an existing active admin.

\set owner_email 'founder@example.com'

insert into public.platform_admins (user_id, role, created_by)
select
  u.id,
  'platform_owner',
  null
from auth.users u
where u.email = :'owner_email'
  and not exists (
    select 1 from public.platform_admins pa where pa.user_id = u.id
  );
