-- 0017 — Make the single-writer design real for admin-facing tables.
-- Supabase grants table DML to the API roles by default, so 0004's promise of
-- "no UPDATE and no DELETE path" for audit_logs rested only on RLS silently
-- matching no visible rows. Revoking the privileges refuses the statement
-- outright, which also protects platform_admins and shop_members, whose only
-- legitimate writers are security-definer functions.

revoke insert, update, delete on public.audit_logs from anon, authenticated;
revoke insert, update, delete on public.platform_admins from anon, authenticated;
revoke insert, update, delete on public.shop_members from anon, authenticated;
