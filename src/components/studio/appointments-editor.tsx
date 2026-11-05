"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  updateStudioAppointment,
  type StudioActionState,
} from "@/lib/actions/studio";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";
import { buttonClasses } from "@/components/ui/button";

export type StudioAppointment = {
  id: string;
  barber_id: string;
  customer_id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  customer_note: string | null;
  cancellation_reason: string | null;
  barber_name: string;
  services: {
    name: string;
    duration_minutes: number;
    price_tnd: number;
  }[];
};

function AppointmentStatusForm({
  shopId,
  appointment,
  status,
}: {
  shopId: string;
  appointment: StudioAppointment;
  status: "cancelled" | "completed" | "no_show";
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    updateStudioAppointment,
    {},
  );
  const submitLabel = {
    cancelled: "cancelAppointment",
    completed: "completeAppointment",
    no_show: "markNoShow",
  }[status];

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="appointmentId" value={appointment.id} />
      <input type="hidden" name="status" value={status} />
      {status === "cancelled" && (
        <label className="grid w-full gap-2 text-sm font-medium">
          {t("cancellationReasonOptional")}
          <input
            type="text"
            name="reason"
            maxLength={250}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus:border-ring focus:outline-none"
          />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses(status === "cancelled" ? "outline" : "primary", "sm")}
      >
        {pending ? t("saving") : t(submitLabel)}
      </button>
      <StudioActionFeedback state={state} />
    </form>
  );
}

export function AppointmentsEditor({
  shopId,
  appointments,
  locale,
  currentTime,
}: {
  shopId: string;
  appointments: StudioAppointment[];
  locale: string;
  currentTime: string;
}) {
  const t = useTranslations("studio");
  const now = new Date(currentTime).getTime();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "Africa/Tunis",
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "TND",
  });

  return (
    <section className="grid gap-6">
      <header>
        <h2 className="font-display text-xl font-semibold">{t("appointmentsTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("appointmentsDescription")}
        </p>
      </header>
      {appointments.length === 0 ? (
        <p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("noAppointments")}
        </p>
      ) : (
        <div className="grid gap-4">
          {appointments.map((appointment) => {
            const ended = new Date(appointment.ends_at).getTime() <= now;
            return (
              <article
                key={appointment.id}
                className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
              >
                <header className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">
                      {dateFormatter.format(new Date(appointment.starts_at))}
                      <span className="mx-2" aria-hidden="true">·</span>
                      {timeFormatter.format(new Date(appointment.starts_at))}
                      <span aria-hidden="true"> – </span>
                      {timeFormatter.format(new Date(appointment.ends_at))}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("appointmentStatus")}: {t(`appointmentStatuses.${appointment.status}`)}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("customerReference")}: {appointment.customer_id.slice(-8).toUpperCase()}
                  </p>
                </header>

                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="font-medium">{t("barber")}</dt>
                    <dd className="text-muted-foreground">{appointment.barber_name}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{t("appointmentServices")}</dt>
                    <dd className="text-muted-foreground">
                      {appointment.services.length
                        ? appointment.services
                            .map(
                              (service) =>
                                `${service.name} · ${service.duration_minutes} ${t("minutesShort")} · ${currencyFormatter.format(service.price_tnd)}`,
                            )
                            .join(", ")
                        : t("appointmentServicesUnavailable")}
                    </dd>
                  </div>
                  {appointment.customer_note && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium">{t("customerNote")}</dt>
                      <dd className="whitespace-pre-wrap text-muted-foreground">
                        {appointment.customer_note}
                      </dd>
                    </div>
                  )}
                  {appointment.cancellation_reason && (
                    <div className="sm:col-span-2">
                      <dt className="font-medium">{t("cancellationReason")}</dt>
                      <dd className="whitespace-pre-wrap text-muted-foreground">
                        {appointment.cancellation_reason}
                      </dd>
                    </div>
                  )}
                </dl>

                {appointment.status === "confirmed" && (
                  <div className="flex flex-wrap items-end gap-4 border-t border-border pt-4">
                    <AppointmentStatusForm
                      shopId={shopId}
                      appointment={appointment}
                      status="cancelled"
                    />
                    {ended && (
                      <>
                        <AppointmentStatusForm
                          shopId={shopId}
                          appointment={appointment}
                          status="completed"
                        />
                        <AppointmentStatusForm
                          shopId={shopId}
                          appointment={appointment}
                          status="no_show"
                        />
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
