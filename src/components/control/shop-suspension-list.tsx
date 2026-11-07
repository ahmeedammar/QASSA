"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setShopSuspension, type ControlActionState } from "@/lib/actions/control";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { shopStatus, type ControlShop } from "@/lib/control/types";

export type { ControlShop } from "@/lib/control/types";

const STATUS_STYLES = {
  published: "bg-success/15 text-success ring-success/30",
  draft: "bg-surface text-muted-foreground ring-border",
  suspended: "bg-danger/15 text-danger ring-danger/30",
} as const;

function SuspensionFeedback({ state }: { state: ControlActionState }) {
  const t = useTranslations("control");
  if (state.error) {
    return (
      <p role="alert" className="qassa-slide-in text-sm text-danger">
        {t(`errors.${state.error}`)}
      </p>
    );
  }
  if (state.success === "saved") {
    return (
      <p role="status" className="qassa-slide-in text-sm text-success">
        {t("saved")}
      </p>
    );
  }
  return null;
}

function SuspensionForm({
  shop,
  suspend,
}: {
  shop: ControlShop;
  suspend: boolean;
}) {
  const t = useTranslations("control");
  const [state, formAction, pending] = useActionState<ControlActionState, FormData>(
    setShopSuspension,
    {},
  );

  return (
    <form action={formAction} className="grid gap-2 sm:w-64">
      <input type="hidden" name="shopId" value={shop.id} />
      <input type="hidden" name="shopSlug" value={shop.slug} />
      <input type="hidden" name="suspend" value={suspend ? "true" : "false"} />
      {suspend && (
        <label className="grid gap-1 text-sm">
          {t("reason")}
          <input
            name="reason"
            maxLength={250}
            placeholder={t("reasonPlaceholder")}
            className={inputClasses()}
          />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses(
          suspend ? "outline" : "primary",
          "sm",
          "qassa-cta w-full",
        )}
      >
        {pending && (
          <span
            aria-hidden="true"
            className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        {pending ? t("saving") : suspend ? t("suspend") : t("restore")}
      </button>
      <SuspensionFeedback state={state} />
    </form>
  );
}

export function ShopSuspensionList({
  shops,
  locale,
  canSuspend,
}: {
  shops: ControlShop[];
  locale: string;
  canSuspend: boolean;
}) {
  const t = useTranslations("control");
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Africa/Tunis",
  });

  if (!shops.length) {
    return (
      <p className="qassa-slide-in rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="qassa-stagger grid gap-4">
      {shops.map((shop) => {
        const status = shopStatus(shop);
        return (
          <article
            key={shop.id}
            className="qassa-card grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-accent/25 to-accent/5 font-display text-lg font-bold text-accent ring-1 ring-accent/20"
              >
                {shop.name.trim().charAt(0).toUpperCase() || "?"}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold">{shop.name}</h2>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_STYLES[status]}`}
                  >
                    <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                    {t(status)}
                  </span>
                </div>
                <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                  /{shop.slug}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  {shop.city && <span>{shop.city}</span>}
                  <span>
                    {t("created")} {dateFormatter.format(new Date(shop.created_at))}
                  </span>
                  {status === "published" && (
                    <Link
                      href={`/shop/${shop.slug}`}
                      className="font-medium text-accent underline-offset-4 hover:underline"
                    >
                      {t("visitShop")}
                    </Link>
                  )}
                </p>
                {shop.suspension_reason && (
                  <p className="mt-3 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2 text-sm">
                    <span className="font-semibold text-danger">{t("reason")}: </span>
                    {shop.suspension_reason}
                  </p>
                )}
              </div>
            </div>
            {canSuspend && (
              <SuspensionForm shop={shop} suspend={!shop.is_suspended} />
            )}
          </article>
        );
      })}
    </div>
  );
}