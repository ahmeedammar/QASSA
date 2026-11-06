import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { ShopBooking } from "@/components/booking/shop-booking";
import { BarberAvatar } from "@/components/shop/barber-avatar";
import { Reveal } from "@/components/shop/reveal";
import { StorefrontGallery } from "@/components/shop/storefront-gallery";
import { StorefrontHero } from "@/components/shop/storefront-hero";
import { createClient } from "@/lib/supabase/server";
import { getPublicShopBySlug } from "@/lib/shops/marketplace";
import { publicMediaUrl } from "@/lib/shops/media";
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

  const logoUrl = publicMediaUrl(shop.logo_path);
  const coverUrl = publicMediaUrl(shop.cover_path);
  const galleryUrls = shop.gallery_paths
    .map((path) => publicMediaUrl(path))
    .filter((url): url is string => Boolean(url));
  const priceFormat = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "TND",
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  const lowestPrice = shop.services.length
    ? Math.min(...shop.services.map((service) => service.price_tnd))
    : null;
  const todayWeekday = new Date(`${currentDate}T00:00:00.000Z`).getUTCDay();
  const weekdayFormat = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  });

  return (
    <main className={`min-h-[calc(100vh-64px)] ${template.shell}`}>
      <div className="mx-auto max-w-5xl px-6 pb-28 pt-10 sm:pt-14 lg:pb-20">
        <Link
          href="/discover"
          className={`inline-flex min-h-11 items-center font-medium hover:underline ${template.accent}`}
        >
          {t("backToDiscover")}
        </Link>

        <div className="mt-6">
          <StorefrontHero
            shopName={shop.name}
            description={shop.description}
            city={shop.city}
            phone={shop.phone}
            templateName={t(`templates.${template.label}`)}
            logoUrl={logoUrl}
            coverUrl={coverUrl}
            galleryUrls={galleryUrls}
            serviceCount={shop.services.length}
            lowestPriceTnd={lowestPrice}
            locale={locale}
            template={template}
          />
        </div>

        <StorefrontGallery urls={galleryUrls} shopName={shop.name} template={template} />

        {(shop.city || shop.address || shop.phone) && (
          <Reveal
            as="section"
            aria-label={t("contactDetails")}
            className={`mt-16 grid gap-4 rounded-2xl border p-6 sm:grid-cols-2 ${template.panel}`}
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
          </Reveal>
        )}

        <div id="booking" className="scroll-mt-24">
          <ShopBooking
            shop={shop}
            locale={locale}
            today={currentDate}
            lastBookableDate={lastDateString}
            authenticated={Boolean(user)}
            panelClass={template.panel}
            accentClass={template.accent}
          />
        </div>

        <div className="mt-16 grid gap-10 lg:grid-cols-2">
          <Reveal as="section" aria-labelledby="services-title">
            <h2
              id="services-title"
              className="font-display text-2xl font-bold sm:text-3xl"
            >
              {t("services")}
            </h2>
            {shop.services.length ? (
              <ul className="mt-5 grid gap-3">
                {shop.services.map((service, index) => (
                  <Reveal
                    as="li"
                    key={service.id}
                    delay={index * 60}
                    className={`qassa-card group rounded-xl border p-5 ${template.panel}`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{service.name}</h3>
                        {service.description && (
                          <p className="mt-1 text-sm opacity-80">
                            {service.description}
                          </p>
                        )}
                        <p className={`mt-2 text-sm ${template.muted}`}>
                          {t("durationMinutes", {
                            minutes: service.duration_minutes,
                          })}
                        </p>
                      </div>
                      <span
                        className={`font-semibold transition-transform duration-300 group-hover:scale-105 ${template.accent}`}
                      >
                        {priceFormat.format(service.price_tnd)}
                      </span>
                    </div>
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="mt-3 opacity-80">{t("noServices")}</p>
            )}
          </Reveal>

          <Reveal as="section" aria-labelledby="barbers-title" delay={80}>
            <h2 id="barbers-title" className="font-display text-2xl font-bold sm:text-3xl">
              {t("barbers")}
            </h2>
            {shop.barbers.length ? (
              <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                {shop.barbers.map((barber, index) => (
                  <Reveal
                    as="li"
                    key={barber.id}
                    delay={index * 60}
                    className={`qassa-card group h-full rounded-2xl border p-4 ${template.panel}`}
                  >
                    <BarberAvatar
                      name={barber.display_name}
                      url={publicMediaUrl(barber.avatar_path)}
                      alt={t("barberPhotoAria", { name: barber.display_name })}
                    />
                    <h3 className="mt-4 font-semibold">{barber.display_name}</h3>
                    {barber.bio && (
                      <p className={`mt-2 text-sm leading-6 ${template.muted}`}>
                        {barber.bio}
                      </p>
                    )}
                    {barber.serviceIds.some((id) => serviceNames.has(id)) && (
                      <p className={`mt-3 text-sm ${template.muted}`}>
                        {barber.serviceIds
                          .map((id) => serviceNames.get(id))
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </Reveal>
                ))}
              </ul>
            ) : (
              <p className="mt-3 opacity-80">{t("noBarbers")}</p>
            )}
          </Reveal>

          <Reveal as="section" aria-labelledby="hours-title" className="lg:col-span-2">
            <h2 id="hours-title" className="font-display text-2xl font-bold sm:text-3xl">
              {t("hours")}
            </h2>
            {shop.businessHours.length ? (
              <ul
                className={`mt-5 grid gap-3 rounded-2xl border p-6 sm:grid-cols-2 lg:grid-cols-3 ${template.panel}`}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                  const isToday = weekday === todayWeekday;
                  const dayHours = shop.businessHours.filter(
                    (hours) => hours.weekday === weekday,
                  );
                  const isRestDay = dayHours.length === 0;
                  return (
                    <li
                      key={weekday}
                      className={`flex items-center justify-between gap-4 rounded-xl px-3 py-2 ${
                        isToday ? `font-semibold ${template.accent}` : ""
                      } ${isRestDay ? "qassa-rest-row" : ""}`}
                    >
                      <span className="flex items-center gap-2">
                        {weekdayFormat.format(new Date(Date.UTC(2024, 0, 7 + weekday)))}
                        {isToday && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                            <span
                              aria-hidden="true"
                              className="qassa-ring inline-block size-1.5 rounded-full bg-success"
                            />
                            {t("todayBadge")}
                          </span>
                        )}
                      </span>
                      <span dir="ltr" className={isRestDay ? "opacity-70" : ""}>
                        {dayHours.length
                          ? dayHours
                              .map(
                                (hours) =>
                                  `${hours.opens_at.slice(0, 5)}–${hours.closes_at.slice(0, 5)}`,
                              )
                              .join(", ")
                          : t("closedDay")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 opacity-80">{t("noHours")}</p>
            )}
          </Reveal>
        </div>
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 lg:hidden">
        <div
          className={`pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-2xl border p-2 shadow-2xl backdrop-blur ${template.panel}`}
        >
          {lowestPrice !== null && (
            <span className="min-w-0 flex-1 truncate px-2 text-sm">
              {t("heroFrom", { price: priceFormat.format(lowestPrice) })}
            </span>
          )}
          {shop.phone && (
            <a
              href={`tel:${shop.phone}`}
              className={`inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold ${template.ghost}`}
            >
              {t("heroCall")}
            </a>
          )}
          <a
            href="#booking"
            className={`qassa-cta inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-semibold ${template.cta}`}
          >
            {t("heroBook")}
          </a>
        </div>
      </div>
    </main>
  );
}
