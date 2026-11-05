"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createShop, type CreateShopState } from "@/lib/actions/shops";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";

export function CreateShopForm() {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<CreateShopState, FormData>(
    createShop,
    {},
  );

  return (
    <form action={formAction} className="grid gap-5">
      <label className="grid gap-2 text-sm font-medium">
        {t("shopName")}
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
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
          autoCapitalize="none"
          autoComplete="off"
          className={inputClasses()}
        />
        <span className="text-xs font-normal text-muted-foreground">
          {t("shopSlugHelp")}
        </span>
      </label>

      <label className="grid gap-2 text-sm font-medium">
        {t("city")}
        <input name="city" maxLength={120} className={inputClasses()} />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        {t("address")}
        <input name="address" maxLength={240} className={inputClasses()} />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        {t("phone")}
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className={inputClasses()}
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        {t("description")}
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        {t("template")}
        <select
          name="templateId"
          defaultValue="classic_gentleman"
          className={inputClasses()}
        >
          <option value="royal_gold">{t("templates.royalGold")}</option>
          <option value="urban_cut">{t("templates.urbanCut")}</option>
          <option value="classic_gentleman">
            {t("templates.classicGentleman")}
          </option>
          <option value="minimal_studio">{t("templates.minimalStudio")}</option>
          <option value="dark_prestige">{t("templates.darkPrestige")}</option>
        </select>
      </label>

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
          {t("created")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("primary", "md")}
      >
        {pending ? t("creating") : t("createShop")}
      </button>
    </form>
  );
}
