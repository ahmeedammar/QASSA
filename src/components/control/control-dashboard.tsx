"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ShopSuspensionList } from "./shop-suspension-list";
import { inputClasses } from "@/components/ui/input";
import {
  PLATFORM_SHOP_PAGE_SIZE,
  shopStatus,
  type ControlShop,
  type ShopStatus,
} from "@/lib/control/types";

type StatusFilter = "all" | ShopStatus;
type SortKey = "recent" | "name";

const FILTERS: StatusFilter[] = ["all", "published", "draft", "suspended"];

const TILE_STYLES: Record<ShopStatus, string> = {
  published: "text-success",
  draft: "text-muted-foreground",
  suspended: "text-danger",
};

export function ControlDashboard({
  shops,
  locale,
  canSuspend,
  truncated,
}: {
  shops: ControlShop[];
  locale: string;
  canSuspend: boolean;
  truncated: boolean;
}) {
  const t = useTranslations("control");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");

  const counts = useMemo(() => {
    const base = { all: shops.length, published: 0, draft: 0, suspended: 0 };
    for (const shop of shops) base[shopStatus(shop)] += 1;
    return base;
  }, [shops]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = shops.filter((shop) => {
      if (status !== "all" && shopStatus(shop) !== status) return false;
      if (!needle) return true;
      return (
        shop.name.toLowerCase().includes(needle) ||
        shop.slug.toLowerCase().includes(needle) ||
        (shop.city ?? "").toLowerCase().includes(needle)
      );
    });
    return filtered.sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name, locale)
        : b.created_at.localeCompare(a.created_at),
    );
  }, [shops, query, status, sort, locale]);

  return (
    <div className="grid gap-6">
      <div className="qassa-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FILTERS.map((filter) => {
          const active = status === filter;
          return (
            <button
              key={filter}
              type="button"
              onClick={() => setStatus(filter)}
              aria-pressed={active}
              aria-label={t("statsTile", { label: t(`stats.${filter}`), count: counts[filter] })}
              className={`qassa-card grid gap-1 rounded-2xl border p-5 text-start transition-colors ${
                active
                  ? "border-ring bg-ring/5 ring-1 ring-ring"
                  : "border-border bg-card hover:border-ring/40"
              }`}
            >
              <span className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                {t(`stats.${filter}`)}
              </span>
              <span
                className={`font-display text-3xl font-bold tabular-nums ${
                  filter === "all" ? "text-foreground" : TILE_STYLES[filter]
                }`}
              >
                {counts[filter]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <label className="grid gap-1">
          <span className="sr-only">{t("searchLabel")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={80}
            placeholder={t("searchPlaceholder")}
            className={inputClasses()}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="shrink-0 text-muted-foreground">{t("sortLabel")}</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className={inputClasses("w-auto")}
          >
            <option value="recent">{t("sortRecent")}</option>
            <option value="name">{t("sortName")}</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-muted-foreground">
          {t("resultCount", { shown: visible.length, total: shops.length })}
        </p>
        {!canSuspend && (
          <p className="rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border">
            {t("readOnly")}
          </p>
        )}
      </div>

      {truncated && (
        <p className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm">
          {t("truncated", { limit: PLATFORM_SHOP_PAGE_SIZE })}
        </p>
      )}

      {shops.length > 0 && visible.length === 0 ? (
        <p className="qassa-slide-in rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          {t("noMatches")}
        </p>
      ) : (
        <ShopSuspensionList shops={visible} locale={locale} canSuspend={canSuspend} />
      )}
    </div>
  );
}