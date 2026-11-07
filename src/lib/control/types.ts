/** list_platform_shops() caps its result set; reaching the cap means "maybe more". */
export const PLATFORM_SHOP_PAGE_SIZE = 100;

export type ControlShop = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  is_published: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
};

export type ControlShopsResult =
  | { status: "ok"; shops: ControlShop[]; truncated: boolean }
  | { status: "unauthenticated" }
  | { status: "forbidden" }
  | { status: "failed"; code: string; detail: string };

export type ShopStatus = "published" | "draft" | "suspended";

export function shopStatus(shop: ControlShop): ShopStatus {
  if (shop.is_suspended) return "suspended";
  return shop.is_published ? "published" : "draft";
}