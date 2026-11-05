"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";
import {
  saveShopWebsite,
  setShopPublished,
  type StudioActionState,
} from "@/lib/actions/studio";
import {
  SHOP_TEMPLATES,
  type ShopTemplateId,
} from "@/lib/shops/templates";
import { Link } from "@/i18n/navigation";

export type WebsiteSettings = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  description: string | null;
  template_id: ShopTemplateId;
  is_published: boolean;
  is_suspended: boolean;
};

const templateIds = Object.keys(SHOP_TEMPLATES) as ShopTemplateId[];

export function WebsiteSettingsEditor({ shop }: { shop: WebsiteSettings }) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveShopWebsite,
    {},
  );

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div>
        <h2 className="font-display text-xl font-semibold">{t("websiteTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("websiteDescription")}
        </p>
      </div>

      <form action={formAction} className="grid gap-5">
        <input type="hidden" name="shopId" value={shop.id} />
        <label className="grid gap-2 text-sm font-medium">
          {t("shopName")}
          <input
            name="name"
            required
            minLength={2}
            maxLength={120}
            defaultValue={shop.name}
            autoComplete="organization"
            className={inputClasses()}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("shopSlug")}
          <input
            name="slug"
            required
            minLength={3}
            maxLength={60}
            pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
            defaultValue={shop.slug}
            autoCapitalize="none"
            autoComplete="off"
            className={inputClasses()}
          />
          <span className="text-xs font-normal text-muted-foreground">
            {t("shopSlugHelp")}
          </span>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            {t("city")}
            <input
              name="city"
              maxLength={120}
              defaultValue={shop.city ?? ""}
              className={inputClasses()}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t("address")}
            <input
              name="address"
              maxLength={240}
              defaultValue={shop.address ?? ""}
              className={inputClasses()}
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          {t("phone")}
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={40}
            defaultValue={shop.phone ?? ""}
            className={inputClasses()}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          {t("description")}
          <textarea
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={shop.description ?? ""}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
          />
        </label>

        <fieldset className="grid gap-3">
          <legend className="mb-1 text-sm font-medium">{t("template")}</legend>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {templateIds.map((templateId) => {
              const template = SHOP_TEMPLATES[templateId];
              return (
                <label key={templateId} className="group relative cursor-pointer">
                  <input
                    className="peer sr-only"
                    type="radio"
                    name="templateId"
                    value={templateId}
                    defaultChecked={shop.template_id === templateId}
                    required
                  />
                  <span className="absolute end-3 top-3 z-10 size-4 rounded-full border border-current bg-card peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring" />
                  <span className="block rounded-xl border-2 border-border p-3 transition-colors peer-checked:border-ring peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring">
                    <span
                      className={`flex h-24 flex-col justify-between rounded-lg p-3 ${template.preview}`}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em]">
                        QASSA
                      </span>
                      <span className="grid gap-1">
                        <span className="h-2 w-3/4 rounded bg-current opacity-80" />
                        <span className="h-1.5 w-1/2 rounded bg-current opacity-40" />
                      </span>
                      <span className="flex gap-1.5">
                        <span className="h-3 w-9 rounded border border-current opacity-50" />
                        <span className="h-3 w-9 rounded border border-current opacity-50" />
                      </span>
                    </span>
                    <span className="mt-3 block pe-6 text-sm font-semibold">
                      {t(`templates.${template.label}`)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <StudioActionFeedback state={state} />
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "md", "justify-self-start")}
        >
          {pending ? t("saving") : t("saveWebsite")}
        </button>
      </form>

      <div className="grid gap-4 border-t border-border pt-6 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h3 className="font-semibold">{t("publicationTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {shop.is_suspended
              ? t("suspended")
              : shop.is_published
                ? t("websiteIsPublished")
                : t("websiteIsDraft")}
          </p>
          {shop.is_published && !shop.is_suspended && (
            <Link
              href={`/shop/${shop.slug}`}
              className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("viewWebsite")}
            </Link>
          )}
        </div>
        <PublishButton shop={shop} />
      </div>
    </section>
  );
}

function PublishButton({ shop }: { shop: WebsiteSettings }) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    setShopPublished,
    {},
  );
  const shouldPublish = !shop.is_published;

  return (
    <form action={formAction} className="grid justify-items-start gap-3">
      <input type="hidden" name="shopId" value={shop.id} />
      <input type="hidden" name="publish" value={String(shouldPublish)} />
      <button
        type="submit"
        disabled={pending || shop.is_suspended}
        className={buttonClasses(
          shouldPublish ? "primary" : "outline",
          "md",
        )}
      >
        {pending
          ? t("saving")
          : shouldPublish
            ? t("publishWebsite")
            : t("unpublishWebsite")}
      </button>
      <StudioActionFeedback state={state} />
    </form>
  );
}
