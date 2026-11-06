import { getTranslations } from "next-intl/server";
import { DiscoverHero } from "@/components/discover/discover-hero";
import { ShopCard } from "@/components/discover/shop-card";
import { Reveal } from "@/components/shop/reveal";
import { Link } from "@/i18n/navigation";
import {
  listMarketplaceCities,
  listPublicShops,
  MARKETPLACE_PAGE_SIZE,
} from "@/lib/shops/marketplace";
import {
  parseMarketplaceFilter,
  parseMarketplacePage,
} from "@/lib/shops/filters";

export const instant = false;

type DiscoverPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    city?: string | string[];
    page?: string | string[];
  }>;
};

/** Weekday (0 = Sunday, matching `closed_weekday`) in the shop's own timezone. */
function tunisWeekday(now = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Tunis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const [t, params, cities] = await Promise.all([
    getTranslations("discover"),
    searchParams,
    listMarketplaceCities(),
  ]);
  const search = parseMarketplaceFilter(params.q);
  const city = parseMarketplaceFilter(params.city);
  const page = parseMarketplacePage(params.page);
  const validFilters = search.valid && city.valid && page.valid;
  const result = validFilters
    ? await listPublicShops({
        search: search.value,
        city: city.value,
        page: page.value,
      })
    : null;
  const pageCount = result?.ok
    ? Math.max(1, Math.ceil(result.count / MARKETPLACE_PAGE_SIZE))
    : 1;
  const query = {
    ...(search.value ? { q: search.value } : {}),
    ...(city.value ? { city: city.value } : {}),
  };
  const todayWeekday = tunisWeekday();
  const isBrowsing = !search.value && !city.value && page.value === 1;
  const steps = [
    { title: t("stepsPick"), text: t("stepsPickText") },
    { title: t("stepsTime"), text: t("stepsTimeText") },
    { title: t("stepsVisit"), text: t("stepsVisitText") },
  ];

  return (
    <>
      <DiscoverHero
        search={search.value}
        city={city.value}
        cities={cities}
        shopCount={result?.ok ? result.count : 0}
      />

      <main className="mx-auto max-w-6xl px-6 pb-16 pt-10 sm:px-8">
        {!validFilters ? (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-5 text-danger">
            {t("invalidFilters")}
          </p>
        ) : result && !result.ok ? (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 p-5 text-danger">
            {t("loadError")}
          </p>
        ) : result?.ok && result.shops.length ? (
          <>
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold">
                {city.value || search.value
                  ? t("resultsFor", { term: city.value || search.value })
                  : t("allShops")}
              </h2>
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {t("results", { count: result.count })}
              </p>
            </div>

            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {result.shops.map((shop, index) => (
                <Reveal
                  as="li"
                  key={shop.id}
                  delay={Math.min(index, 8) * 70}
                  className="h-full"
                >
                  <ShopCard
                    shop={shop}
                    closedToday={shop.closed_weekday === todayWeekday}
                  />
                </Reveal>
              ))}
            </ul>

            {pageCount > 1 && (
              <nav
                aria-label={t("paginationLabel")}
                className="mt-10 flex items-center justify-between gap-4"
              >
                {page.value > 1 ? (
                  <Link
                    href={{
                      pathname: "/discover",
                      query: { ...query, page: String(page.value - 1) },
                    }}
                    className="min-h-11 rounded-lg border border-border px-4 py-2 font-medium transition-colors hover:bg-surface"
                  >
                    {t("previousPage")}
                  </Link>
                ) : (
                  <span />
                )}
                <span className="text-sm text-muted-foreground">
                  {t("pageOf", { page: page.value, pages: pageCount })}
                </span>
                {page.value < pageCount ? (
                  <Link
                    href={{
                      pathname: "/discover",
                      query: { ...query, page: String(page.value + 1) },
                    }}
                    className="qassa-cta min-h-11 rounded-lg bg-primary px-5 py-2 font-semibold text-primary-foreground"
                  >
                    {t("nextPage")}
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}

            {isBrowsing && (
              <Reveal as="section" className="mt-16">
                <h2 className="text-center font-display text-2xl font-bold">
                  {t("stepsTitle")}
                </h2>
                <ol className="mt-8 grid gap-5 sm:grid-cols-3">
                  {steps.map((step, index) => (
                    <li
                      key={step.title}
                      className="qassa-card rounded-3xl border border-border bg-card p-6"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-primary/12 font-display text-lg font-bold text-primary">
                        {index + 1}
                      </span>
                      <h3 className="mt-4 font-display text-lg font-semibold">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {step.text}
                      </p>
                    </li>
                  ))}
                </ol>
              </Reveal>
            )}
          </>
        ) : (
          <section className="rounded-3xl border border-border bg-card px-6 py-14 text-center">
            <h2 className="font-display text-2xl font-semibold">
              {t("emptyTitle")}
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              {search.value || city.value ? t("emptyFiltered") : t("empty")}
            </p>
            {(search.value || city.value) && (
              <Link
                href="/discover"
                className="qassa-cta mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground"
              >
                {t("clearFilters")}
              </Link>
            )}
          </section>
        )}
      </main>
    </>
  );
}
