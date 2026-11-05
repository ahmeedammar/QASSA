"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { cancelCustomerAppointment } from "@/lib/actions/booking";
import type { BookingActionState } from "@/lib/actions/booking";
import { buttonClasses } from "@/components/ui/button";

export type CustomerAppointment = {
  id: string;
  starts_at: string;
  ends_at: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  customer_note: string | null;
  cancellation_reason: string | null;
  shop_name: string;
  barber_name: string;
  services: { name: string; price_tnd: number; duration_minutes: number }[];
};

function CancelAppointmentForm({ appointmentId }: { appointmentId: string }) {
  const t = useTranslations("account");
  const [state, formAction, pending] = useActionState<BookingActionState, FormData>(
    cancelCustomerAppointment,
    {},
  );
  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="appointmentId" value={appointmentId} />
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state.success === "cancelled" && (
        <p role="status" className="text-sm text-success">{t("cancelled")}</p>
      )}
      {state.success !== "cancelled" && (
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("outline", "sm")}
        >
          {pending ? t("cancelling") : t("cancelAppointment")}
        </button>
      )}
    </form>
  );
}

export function CustomerAppointments({
  appointments,
  locale,
  currentTime,
}: {
  appointments: CustomerAppointment[];
  locale: string;
  currentTime: string;
}) {
  const t = useTranslations("account");
  const now = new Date(currentTime).getTime();
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
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

  if (!appointments.length) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {appointments.map((appointment) => {
        const startsAt = new Date(appointment.starts_at);
        const endsAt = new Date(appointment.ends_at);
        const canCancel =
          appointment.status === "confirmed" && startsAt.getTime() > now;
        return (
          <article
            key={appointment.id}
            className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:p-6"
          >
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">{appointment.shop_name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dateFormatter.format(startsAt)} · {timeFormatter.format(startsAt)}–
                  {timeFormatter.format(endsAt)}
                </p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1 text-sm">
                {t(`statuses.${appointment.status}`)}
              </span>
            </header>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium">{t("barber")}</dt>
                <dd className="text-muted-foreground">{appointment.barber_name}</dd>
              </div>
              <div>
                <dt className="font-medium">{t("services")}</dt>
                <dd className="text-muted-foreground">
                  {appointment.services.length
                    ? appointment.services
                        .map(
                          (service) =>
                            `${service.name} · ${service.duration_minutes} ${t("minutes")} · ${currencyFormatter.format(service.price_tnd)}`,
                        )
                        .join(", ")
                    : t("serviceUnavailable")}
                </dd>
              </div>
              {appointment.customer_note && (
                <div className="sm:col-span-2">
                  <dt className="font-medium">{t("note")}</dt>
                  <dd className="whitespace-pre-wrap text-muted-foreground">
                    {appointment.customer_note}
                  </dd>
                </div>
              )}
              {appointment.cancellation_reason && (
                <div className="sm:col-span-2">
                  <dt className="font-medium">{t("cancellationReason")}</dt>
                  <dd className="text-muted-foreground">
                    {appointment.cancellation_reason}
                  </dd>
                </div>
              )}
            </dl>
            {canCancel && <CancelAppointmentForm appointmentId={appointment.id} />}
            {appointment.status === "confirmed" && !canCancel && (
              <p className="text-sm text-muted-foreground">{t("cancellationClosed")}</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
