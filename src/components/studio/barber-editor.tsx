"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inputClasses } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import {
  saveBarberServices,
  saveShopBarber,
  setShopBarberActive,
  type StudioActionState,
} from "@/lib/actions/studio";
import type { StudioService } from "@/components/studio/service-editor";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";

export type StudioBarber = {
  id: string;
  display_name: string;
  bio: string | null;
  is_active: boolean;
};

function BarberProfileForm({
  shopId,
  barber,
}: {
  shopId: string;
  barber?: StudioBarber;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveShopBarber,
    {},
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="shopId" value={shopId} />
      {barber && <input type="hidden" name="barberId" value={barber.id} />}
      <label className="grid gap-2 text-sm font-medium">
        {t("barberName")}
        <input
          name="displayName"
          required
          minLength={1}
          maxLength={120}
          defaultValue={barber?.display_name}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("barberBio")}
        <textarea
          name="bio"
          rows={2}
          maxLength={1000}
          defaultValue={barber?.bio ?? ""}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>
      <StudioActionFeedback state={state} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("primary", "sm", "justify-self-start")}
      >
        {pending ? t("saving") : barber ? t("saveChanges") : t("addBarber")}
      </button>
    </form>
  );
}

function BarberStatusForm({
  shopId,
  barber,
}: {
  shopId: string;
  barber: StudioBarber;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    setShopBarberActive,
    {},
  );

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="recordId" value={barber.id} />
      <input type="hidden" name="active" value={String(!barber.is_active)} />
      <span className="text-sm text-muted-foreground">
        {barber.is_active ? t("active") : t("inactive")}
      </span>
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("outline", "sm")}
      >
        {barber.is_active ? t("deactivate") : t("activate")}
      </button>
      <StudioActionFeedback state={state} />
    </form>
  );
}

function BarberAssignmentsForm({
  shopId,
  barber,
  services,
  assignedServiceIds,
}: {
  shopId: string;
  barber: StudioBarber;
  services: StudioService[];
  assignedServiceIds: string[];
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveBarberServices,
    {},
  );

  return (
    <form action={formAction} className="grid gap-3 border-t border-border pt-4">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="barberId" value={barber.id} />
      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">{t("assignedServices")}</legend>
        {services.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("createServicesFirst")}</p>
        ) : (
          services.map((service) => (
            <label key={service.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="serviceIds"
                value={service.id}
                defaultChecked={assignedServiceIds.includes(service.id)}
                disabled={!barber.is_active || !service.is_active}
                className="size-4 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <span>
                {service.name}
                {!service.is_active && (
                  <span className="ms-2 text-xs text-muted-foreground">
                    {t("inactive")}
                  </span>
                )}
              </span>
            </label>
          ))
        )}
      </fieldset>
      <StudioActionFeedback state={state} />
      <button
        type="submit"
        disabled={pending || !barber.is_active || services.length === 0}
        className={buttonClasses("outline", "sm", "justify-self-start")}
      >
        {pending ? t("saving") : t("saveAssignments")}
      </button>
    </form>
  );
}

export function BarberEditor({
  shopId,
  barbers,
  services,
  assignments,
}: {
  shopId: string;
  barbers: StudioBarber[];
  services: StudioService[];
  assignments: { barber_id: string; service_id: string }[];
}) {
  const t = useTranslations("studio");

  return (
    <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div>
        <h2 className="font-display text-xl font-semibold">{t("barbersTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("barbersDescription")}
        </p>
      </div>
      <div className="grid gap-5">
        {barbers.map((barber) => (
          <article
            key={barber.id}
            className="grid gap-5 rounded-xl border border-border p-4 sm:p-5 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <div className="grid gap-5">
              <BarberProfileForm shopId={shopId} barber={barber} />
              <BarberAssignmentsForm
                shopId={shopId}
                barber={barber}
                services={services}
                assignedServiceIds={assignments
                  .filter((assignment) => assignment.barber_id === barber.id)
                  .map((assignment) => assignment.service_id)}
              />
            </div>
            <BarberStatusForm shopId={shopId} barber={barber} />
          </article>
        ))}
        {barbers.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noBarbersYet")}</p>
        )}
      </div>
      <div className="border-t border-border pt-6">
        <h3 className="mb-4 font-semibold">{t("addBarber")}</h3>
        <BarberProfileForm shopId={shopId} />
      </div>
    </section>
  );
}
