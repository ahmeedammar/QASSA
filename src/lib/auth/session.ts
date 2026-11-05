import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Returns the authenticated user or null. Cached per request. */
export const getUser = cache(async () => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    // Supabase unreachable (network/config): degrade to anonymous rather
    // than crashing the page. Auth-gated actions re-verify anyway.
    return null;
  }
});

export async function getUserOrThrow(): Promise<
  NonNullable<Awaited<ReturnType<typeof getUser>>>
> {
  const user = await getUser();
  if (!user) throw new Error("Unauthenticated");
  return user;
}

/**
 * Returns shop IDs the user is an active member of, with their role.
 * Used by tenant-scoped data access — never trust shop_id from the browser.
 */
export async function getShopMemberships(): Promise<
  { shopId: string; role: string }[]
> {
  const user = await getUser();
  if (!user) return [];

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("shop_members")
      .select("shop_id, role")
      .eq("user_id", user.id)
      .eq("is_active", true);

    return (data ?? []).map((m) => ({ shopId: m.shop_id, role: m.role }));
  } catch {
    return [];
  }
}

export async function isMemberOf(shopId: string): Promise<boolean> {
  const memberships = await getShopMemberships();
  return memberships.some((m) => m.shopId === shopId);
}
