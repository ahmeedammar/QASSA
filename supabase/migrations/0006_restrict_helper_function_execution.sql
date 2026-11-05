-- 0006 — Restrict security-definer helper functions to authenticated callers.

revoke execute on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

revoke execute on function public.touch_admin_last_used() from public, anon;
grant execute on function public.touch_admin_last_used() to authenticated;

revoke execute on function public.is_shop_member(uuid, text[]) from public, anon;
grant execute on function public.is_shop_member(uuid, text[]) to authenticated;
