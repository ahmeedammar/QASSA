"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import { createShopSchema } from "@/lib/validation/shops";

export type CreateShopState = {
  error?: "invalid_input" | "too_many_requests" | "slug_taken" | "failed";
  success?: "created";
};

export async function createShop(
  _previousState: CreateShopState,
  formData: FormData,
): Promise<CreateShopState> {
  const parsed = createShopSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    city: formData.get("city") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    description: formData.get("description") ?? "",
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect(`/${await getLocale()}/login`);

  const requestHeaders = await headers();
  const limit = await rateLimit(
    `shop-create:${user.id}:${clientIp(requestHeaders)}`,
    "auth",
  );
  if (!limit.success) return { error: "too_many_requests" };

  const { error } = await supabase.rpc("create_owned_shop", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_city: parsed.data.city,
    p_address: parsed.data.address,
    p_phone: parsed.data.phone,
    p_description: parsed.data.description,
    p_template_id: parsed.data.templateId,
  });

  if (error) {
    if (error.code === "23505") return { error: "slug_taken" };
    console.error("Failed to create owner shop", error);
    return { error: "failed" };
  }

  revalidatePath(`/${await getLocale()}/studio`);
  return { success: "created" };
}
