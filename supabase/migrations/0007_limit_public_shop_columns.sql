-- 0007 — Expose only fields intended for public shop pages.

revoke select on public.barbershops from anon, authenticated;
grant select (
  id,
  name,
  slug,
  city,
  address,
  phone,
  description,
  template_id,
  is_published,
  is_suspended
) on public.barbershops to anon, authenticated;

create view public.public_barbershops
with (security_invoker = true)
as
select id, name, slug, city, address, phone, description, template_id
from public.barbershops
where is_published and not is_suspended;

grant select on public.public_barbershops to anon, authenticated;
