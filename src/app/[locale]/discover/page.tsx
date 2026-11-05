import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
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

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const [t, params] = await Promise.all([
    getTranslations("discover"),
    searchParams,
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

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
      <header className="mb-10 max-w-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          QASSA · قصّة
        </p>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-muted-foreground">{t("description")}</p>
      </header>

      <form
        action=""
        method="get"
        className="mb-8 grid gap-4 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
      >
        <label className="grid gap-2 text-sm font-medium">
          {t("searchLabel")}
          <input
            type="search"
            name="q"
            defaultValue={search.value}
            maxLength={80}
            placeholder={t("searchPlaceholder")}
            className="h-11 rounded-lg border border-border bg-background px-3 font-normal text-foreground"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("cityLabel")}
          <input
            type="text"
            name="city"
            defaultValue={city.value}
            maxLength={80}
            placeholder={t("cityPlaceholder")}
            className="h-11 rounded-lg border border-border bg-background px-3 font-normal text-foreground"
          />
        </label>
        <button
          type="submit"
          className="h-11 rounded-lg bg-primary px-6 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {t("searchButton")}
        </button>
      </form>

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
          <p className="mb-5 text-sm text-muted-foreground" aria-live="polite">
            {t("results", { count: result.count })}
          </p>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.shops.map((shop) => (
              <li key={shop.id}>
                <article className="flex h-full flex-col rounded-2xl border border-border bg-card p-6">
                  <h2 className="font-display text-xl font-bold">{shop.name}</h2>
                  {(shop.city || shop.address) && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {[shop.city, shop.address].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {shop.description && (
                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-muted-foreground">
                      {shop.description}
                    </p>
                  )}
                  <Link
                      href={`/shop/${encodeURIComponent(shop.slug)}`}
                    className="mt-auto inline-flex min-h-11 items-center pt-5 font-semibold text-primary hover:underline"
                  >
                    {t("visitShop")}
                  </Link>
                </article>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <nav
              aria-label={t("paginationLabel")}
              className="mt-8 flex items-center justify-between gap-4"
            >
              {page.value > 1 ? (
                <Link
                  href={{
                    pathname: "/discover",
                    query: { ...query, page: String(page.value - 1) },
                  }}
                  className="min-h-11 rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface"
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
                  className="min-h-11 rounded-lg border border-border px-4 py-2 font-medium hover:bg-surface"
                >
                  {t("nextPage")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </>
      ) : (
        <section className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
          <h2 className="font-display text-xl font-semibold">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
            {search.value || city.value ? t("emptyFiltered") : t("empty")}
          </p>
        </section>
      )}
    </main>
  );
}
