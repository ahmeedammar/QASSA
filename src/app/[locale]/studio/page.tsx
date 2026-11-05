import { getLocale, getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { CreateShopForm } from "@/components/studio/create-shop-form";
import { getUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type Shop = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  template_id: string;
  is_published: boolean;
  is_suspended: boolean;
};

export default async function StudioPage() {
  const [t, user] = await Promise.all([
    getTranslations("studio"),
    getUser(),
  ]);
  const locale = await getLocale();
  if (!user) redirect({ href: "/login", locale });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_shops");
  if (error) console.error("Failed to load Studio shops", error);
  const shops: Shop[] = data ?? [];

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <header className="mb-10">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("description")}</p>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("loadError")}
        </p>
      ) : (
        <section className="grid gap-8">
          {shops.length > 0 && (
            <div className="grid gap-4">
              <h2 className="font-display text-xl font-semibold">{t("yourShops")}</h2>
              {shops.map((shop) => (
                <article
                  key={shop.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-5"
                >
                  <div>
                    <h3 className="font-semibold">{shop.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {shop.city ? `${shop.city} · ` : ""}
                      {shop.is_suspended
                        ? t("suspended")
                        : shop.is_published
                          ? t("published")
                          : t("draft")}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Link
                      href={`/studio/${shop.id}`}
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t("manageShop")}
                    </Link>
                    {shop.is_published && !shop.is_suspended && (
                      <Link
                        href={`/shop/${shop.slug}`}
                        className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {t("visitShop")}
                      </Link>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h2 className="mb-2 font-display text-xl font-semibold">
              {t("createTitle")}
            </h2>
            <p className="mb-6 text-sm text-muted-foreground">
              {t("createDescription")}
            </p>
            <CreateShopForm />
          </section>
        </section>
      )}
    </main>
  );
}
