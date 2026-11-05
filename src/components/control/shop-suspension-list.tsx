"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setShopSuspension, type ControlActionState } from "@/lib/actions/control";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";

export type ControlShop = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  is_published: boolean;
  is_suspended: boolean;
  suspension_reason: string | null;
  created_at: string;
};

function SuspensionFeedback({ state }: { state: ControlActionState }) {
  const t = useTranslations("control");
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-danger">
        {t(`errors.${state.error}`)}
      </p>
    );
  }
  if (state.success === "saved") {
    return (
      <p role="status" className="text-sm text-success">
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
    <form action={formAction} className="grid gap-2">
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
        className={buttonClasses(suspend ? "outline" : "primary", "sm")}
      >
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
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {shops.map((shop) => (
        <article
          key={shop.id}
          className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
        >
          <div>
            <h2 className="font-semibold">{shop.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {shop.city ? `${shop.city} · ` : ""}
              {shop.is_suspended
                ? t("suspended")
                : shop.is_published
                  ? t("published")
                  : t("draft")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("created")}: {dateFormatter.format(new Date(shop.created_at))}
            </p>
            {shop.suspension_reason && (
              <p className="mt-2 text-sm">{t("reason")}: {shop.suspension_reason}</p>
            )}
          </div>
          {canSuspend && (
            <SuspensionForm shop={shop} suspend={!shop.is_suspended} />
          )}
        </article>
      ))}
    </div>
  );
}
