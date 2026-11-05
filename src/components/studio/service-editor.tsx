"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inputClasses } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import {
  saveShopService,
  setShopServiceActive,
  type StudioActionState,
} from "@/lib/actions/studio";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";

export type StudioService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price_tnd: number;
  is_active: boolean;
};

function ServiceForm({
  shopId,
  service,
}: {
  shopId: string;
  service?: StudioService;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveShopService,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="shopId" value={shopId} />
      {service && <input type="hidden" name="serviceId" value={service.id} />}
      <label className="grid gap-2 text-sm font-medium">
        {t("serviceName")}
        <input
          name="name"
          required
          minLength={1}
          maxLength={120}
          defaultValue={service?.name}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("serviceDescription")}
        <textarea
          name="description"
          rows={2}
          maxLength={1000}
          defaultValue={service?.description ?? ""}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2 text-sm font-medium">
          {t("durationMinutes")}
          <input
            name="durationMinutes"
            type="number"
            min={5}
            max={480}
            step={5}
            required
            defaultValue={service?.duration_minutes ?? 30}
            className={inputClasses()}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("bufferMinutes")}
          <input
            name="bufferMinutes"
            type="number"
            min={0}
            max={120}
            step={5}
            required
            defaultValue={service?.buffer_minutes ?? 0}
            className={inputClasses()}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("priceTnd")}
          <input
            name="priceTnd"
            type="number"
            min={0}
            max={100000}
            step="0.001"
            required
            defaultValue={service?.price_tnd ?? ""}
            className={inputClasses()}
          />
        </label>
      </div>
      <StudioActionFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("primary", "sm", "justify-self-start")}
      >
        {pending ? t("saving") : service ? t("saveChanges") : t("addService")}
      </button>
    </form>
  );
}

function ServiceStatusForm({
  shopId,
  service,
}: {
  shopId: string;
  service: StudioService;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    setShopServiceActive,
    {},
  );

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="recordId" value={service.id} />
      <input type="hidden" name="active" value={String(!service.is_active)} />
      <span className="text-sm text-muted-foreground">
        {service.is_active ? t("active") : t("inactive")}
      </span>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("outline", "sm")}
      >
        {service.is_active ? t("deactivate") : t("activate")}
      </button>
      <StudioActionFeedback state={state} />
    </form>
  );
}

export function ServiceEditor({
  shopId,
  services,
}: {
  shopId: string;
  services: StudioService[];
}) {
  const t = useTranslations("studio");

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div>
        <h2 className="font-display text-xl font-semibold">{t("servicesTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("servicesDescription")}
        </p>
      </div>
      <div className="grid gap-5">
        {services.map((service) => (
          <article
            key={service.id}
            className="grid gap-5 rounded-xl border border-border p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <ServiceForm shopId={shopId} service={service} />
            <ServiceStatusForm shopId={shopId} service={service} />
          </article>
        ))}
        {services.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noServicesYet")}</p>
        )}
      </div>
      <div className="border-t border-border pt-6">
        <h3 className="mb-4 font-semibold">{t("addService")}</h3>
        <ServiceForm shopId={shopId} />
      </div>
    </section>
  );
}
