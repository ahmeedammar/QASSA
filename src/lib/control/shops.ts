import "server-only";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  PLATFORM_SHOP_PAGE_SIZE,
  type ControlShop,
  type ControlShopsResult,
} from "./types";

export { PLATFORM_SHOP_PAGE_SIZE };

const controlShopSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  city: z.string().nullable(),
  is_published: z.boolean(),
  is_suspended: z.boolean(),
  suspension_reason: z.string().nullable(),
  created_at: z.coerce.string(),
});

/**
 * The page gate proves the visitor is an active admin, but the RPC re-checks
 * auth.uid() against the JWT PostgREST actually received. Those can disagree
 * when the session was refreshed mid-render, so the two auth failures are
 * classified here rather than collapsed into one opaque "try again" message.
 */
export async function loadControlShops(): Promise<ControlShopsResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_platform_shops");

  if (error) {
    console.error("Failed to load Control shops", error);
    if (error.code === "28000") return { status: "unauthenticated" };
    if (error.code === "42501") return { status: "forbidden" };
    return {
      status: "failed",
      code: error.code ?? "unknown",
      detail: error.message,
    };
  }

  const parsed = z.array(controlShopSchema).safeParse(data ?? []);
  if (!parsed.success) {
    console.error("Control shops payload did not match the expected shape", parsed.error);
    return {
      status: "failed",
      code: "unexpected_shape",
      detail: parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
        .join("; "),
    };
  }

  const shops: ControlShop[] = parsed.data;
  return {
    status: "ok",
    shops,
    truncated: shops.length >= PLATFORM_SHOP_PAGE_SIZE,
  };
}