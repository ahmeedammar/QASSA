-- 0016 — Shops may only be provisioned through create_owned_shop().
-- The 0003 insert policy let any signed-up user write a bare barbershops row,
-- which 0009's atomic onboarding made an integrity hole: no owner membership,
-- no shop_settings, no user_roles. Those rows are unreachable from the Studio
-- yet still occupy a public slug.

drop policy if exists barbershops_owner_insert on public.barbershops;

revoke insert on public.barbershops from anon, authenticated;
