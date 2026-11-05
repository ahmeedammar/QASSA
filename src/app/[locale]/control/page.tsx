import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ShopSuspensionList, type ControlShop } from "@/components/control/shop-suspension-list";
import { requireControlPageAccess } from "@/lib/auth/control-page";
import { roleHasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

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

export default async function ControlPage() {
  const [locale, t, access] = await Promise.all([
    getLocale(),
    getTranslations("control"),
    requireControlPageAccess("shops.read"),
  ]);

  if (access.status !== "ok") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("forbidden")}
        </p>
      </main>
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_platform_shops");
  if (error) console.error("Failed to load Control shops", error);
  const parsed = z.array(controlShopSchema).safeParse(data ?? []);
  const shops: ControlShop[] = parsed.success ? parsed.data : [];

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-16">
      <header className="grid gap-3">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </header>
      {error || !parsed.success ? (
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("loadError")}
        </p>
      ) : (
        <ShopSuspensionList
          shops={shops}
          locale={locale}
          canSuspend={roleHasPermission(access.ctx.role, "shops.suspend")}
        />
      )}
    </main>
  );
}
