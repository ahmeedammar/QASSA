import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ShopBooking } from "@/components/booking/shop-booking";
import { createClient } from "@/lib/supabase/server";
import { getPublicShopBySlug } from "@/lib/shops/marketplace";
import { SHOP_TEMPLATES } from "@/lib/shops/templates";

export const instant = false;

type ShopPageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({
  params,
}: ShopPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPublicShopBySlug(slug);
  if (!result.ok || !result.shop) return { title: "QASSA" };

  return {
    title: `${result.shop.name} | QASSA`,
    description: result.shop.description ?? result.shop.name,
  };
}

export default async function ShopWebsitePage({ params }: ShopPageProps) {
  const [{ locale, slug }, t, supabase] = await Promise.all([
    params,
    getTranslations("discover"),
    createClient(),
  ]);
  const result = await getPublicShopBySlug(slug);
  if (!result.ok) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-5 text-danger">
          {t("loadError")}
        </p>
      </main>
    );
  }
  if (!result.shop) notFound();
  const shop = result.shop;
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) console.error("Failed to check customer session on shop page", userError);

  const template = SHOP_TEMPLATES[shop.template_id];
  const serviceNames = new Map(
    shop.services.map((service) => [service.id, service.name]),
  );
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Tunis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const currentDate = `${dateParts.find((part) => part.type === "year")?.value}-${dateParts.find((part) => part.type === "month")?.value}-${dateParts.find((part) => part.type === "day")?.value}`;
  const lastDate = new Date(`${currentDate}T00:00:00.000Z`);
  lastDate.setUTCDate(lastDate.getUTCDate() + 60);
  const lastDateString = lastDate.toISOString().slice(0, 10);

  return (
    <main className={`min-h-[calc(100vh-64px)] ${template.shell}`}>
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <Link
          href="/discover"
          className={`inline-flex min-h-11 items-center font-medium hover:underline ${template.accent}`}
        >
          {t("backToDiscover")}
        </Link>
        <header className="mt-12 max-w-3xl">
          <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${template.accent}`}>
            QASSA · {t(`templates.${template.label}`)}
          </p>
          <h1 className="mt-4 font-display text-4xl font-bold sm:text-6xl">
            {shop.name}
          </h1>
          {shop.description && (
            <p className="mt-6 max-w-2xl text-lg leading-8 opacity-80">
              {shop.description}
            </p>
          )}
        </header>

        {(shop.city || shop.address || shop.phone) && (
          <section
            aria-label={t("contactDetails")}
            className={`mt-12 grid gap-4 rounded-2xl border p-6 sm:grid-cols-2 ${template.panel}`}
          >
            {(shop.city || shop.address) && (
              <div>
                <h2 className={`font-semibold ${template.accent}`}>
                  {t("location")}
                </h2>
                <p className="mt-2">
                  {[shop.city, shop.address].filter(Boolean).join(" · ")}
                </p>
              </div>
            )}
            {shop.phone && (
              <div>
                <h2 className={`font-semibold ${template.accent}`}>
                  {t("phone")}
                </h2>
                <a
                  className="mt-2 inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                  href={`tel:${shop.phone}`}
                >
                  {shop.phone}
                </a>
              </div>
            )}
          </section>
        )}

        <ShopBooking
          shop={shop}
          locale={locale}
          today={currentDate}
          lastBookableDate={lastDateString}
          authenticated={Boolean(user)}
          panelClass={template.panel}
          accentClass={template.accent}
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="services-title">
            <h2
              id="services-title"
              className="font-display text-2xl font-bold"
            >
              {t("services")}
            </h2>
            {shop.services.length ? (
              <ul className="mt-4 grid gap-3">
                {shop.services.map((service) => (
                  <li
                    key={service.id}
                    className={`rounded-xl border p-5 ${template.panel}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        {service.description && (
                          <p className="mt-1 text-sm opacity-80">
                            {service.description}
                          </p>
                        )}
                        <p className="mt-2 text-sm opacity-80">
                          {t("durationMinutes", {
                            minutes: service.duration_minutes,
                          })}
                        </p>
                      </div>
                      <span className={`font-semibold ${template.accent}`}>
                        {new Intl.NumberFormat(locale, {
                          style: "currency",
                          currency: "TND",
                          maximumFractionDigits: 3,
                        }).format(service.price_tnd)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 opacity-80">{t("noServices")}</p>
            )}
          </section>

          <section aria-labelledby="barbers-title">
            <h2 id="barbers-title" className="font-display text-2xl font-bold">
              {t("barbers")}
            </h2>
            {shop.barbers.length ? (
              <ul className="mt-4 grid gap-3">
                {shop.barbers.map((barber) => (
                  <li
                    key={barber.id}
                    className={`rounded-xl border p-5 ${template.panel}`}
                  >
                    <h3 className="font-semibold">{barber.display_name}</h3>
                    {barber.bio && (
                      <p className="mt-2 text-sm leading-6 opacity-80">
                        {barber.bio}
                      </p>
                    )}
                    {barber.serviceIds.some((id) => serviceNames.has(id)) && (
                      <p className="mt-2 text-sm opacity-80">
                        {t("barberServices")}:{" "}
                        {barber.serviceIds
                          .map((id) => serviceNames.get(id))
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 opacity-80">{t("noBarbers")}</p>
            )}
          </section>

          <section aria-labelledby="hours-title" className="lg:col-span-2">
            <h2 id="hours-title" className="font-display text-2xl font-bold">
              {t("hours")}
            </h2>
            {shop.businessHours.length ? (
              <ul
                className={`mt-4 grid gap-3 rounded-xl border p-5 sm:grid-cols-2 lg:grid-cols-3 ${template.panel}`}
              >
                {shop.businessHours.map((hours) => (
                  <li key={hours.id} className="flex justify-between gap-4">
                    <span>
                      {new Intl.DateTimeFormat(locale, {
                        weekday: "long",
                        timeZone: "UTC",
                      }).format(new Date(Date.UTC(2024, 0, 7 + hours.weekday)))}
                    </span>
                    <span dir="ltr">
                      {hours.opens_at.slice(0, 5)}–{hours.closes_at.slice(0, 5)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 opacity-80">{t("noHours")}</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
