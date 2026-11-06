"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { bookAppointment, getAvailableSlots } from "@/lib/actions/booking";
import type { BookingActionState } from "@/lib/actions/booking";
import type { PublicShopWebsite } from "@/lib/shops/marketplace";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";

type Props = {
  shop: PublicShopWebsite;
  locale: string;
  today: string;
  lastBookableDate: string;
  authenticated: boolean;
  panelClass: string;
  accentClass: string;
};

/** Stand-in chips shaped like the slot grid they are about to become. */
const SKELETON_SIZES = [
  "h-9 w-[5.5rem]",
  "h-9 w-20",
  "h-9 w-[6.25rem]",
  "h-9 w-[5.25rem]",
  "h-9 w-[6.5rem]",
  "h-9 w-20",
];

function Feedback({ state }: { state: BookingActionState }) {
  const t = useTranslations("booking");
  if (state.error === "login_required") {
    return (
      <p role="alert" className="rounded-lg bg-warning/10 px-4 py-3 text-sm">
        {t("loginRequired")}
      </p>
    );
  }
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
        {t(`errors.${state.error}`)}
      </p>
    );
  }
  return null;
}

export function ShopBooking({
  shop,
  locale,
  today,
  lastBookableDate,
  authenticated,
  panelClass,
  accentClass,
}: Props) {
  const t = useTranslations("booking");
  const eligibleServices = shop.services;
  const [serviceId, setServiceId] = useState(eligibleServices[0]?.id ?? "");
  const eligibleBarbers = shop.barbers.filter((barber) =>
    barber.serviceIds.includes(serviceId),
  );
  const [barberId, setBarberId] = useState(eligibleBarbers[0]?.id ?? "");
  const [date, setDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [slotsState, slotsAction, loadingSlots] = useActionState<
    BookingActionState,
    FormData
  >(getAvailableSlots, {});
  const [bookingState, bookingAction, submittingBooking] = useActionState<
    BookingActionState,
    FormData
  >(bookAppointment, {});
  const currentSlots =
    slotsState.requested?.serviceId === serviceId &&
    slotsState.requested.barberId === barberId &&
    slotsState.requested.date === date
      ? slotsState.slots ?? []
      : [];
  const slotsMatchSelection =
    slotsState.requested?.serviceId === serviceId &&
    slotsState.requested.barberId === barberId &&
    slotsState.requested.date === date;
  const service = eligibleServices.find((item) => item.id === serviceId);
  const formatDate = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeZone: "Africa/Tunis",
  });
  const formatTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Tunis",
  });
  const nextPath = `/${locale}/shop/${shop.slug}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;
  const registerHref = `/register?next=${encodeURIComponent(nextPath)}`;
  const booked =
    bookingState.success === "booked" &&
    bookingState.bookedStartsAt === selectedSlot &&
    bookingState.appointmentId;
  const needsLogin = !authenticated || bookingState.error === "login_required";

  function resetSlot() {
    setSelectedSlot("");
    setIdempotencyKey("");
  }

  return (
    <section
      aria-labelledby="booking-title"
      className={`mt-12 grid gap-6 rounded-2xl border p-6 sm:p-8 ${panelClass}`}
    >
      <header>
        <p className={`text-sm font-semibold uppercase tracking-[0.16em] ${accentClass}`}>
          {t("eyebrow")}
        </p>
        <h2 id="booking-title" className="mt-2 font-display text-2xl font-bold">
          {t("title")}
        </h2>
        <p className="mt-2 text-sm opacity-80">{t("description")}</p>
        {authenticated && (
          <Link
            href="/account/appointments"
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
          >
            {t("viewMyAppointments")}
          </Link>
        )}
      </header>

      {eligibleServices.length === 0 ? (
        <p role="status" className="rounded-lg bg-surface/50 px-4 py-3 text-sm">
          {t("noServices")}
        </p>
      ) : (
        <>
          <form action={slotsAction} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="shopId" value={shop.id} />
            <label className="grid gap-2 text-sm font-medium">
              {t("service")}
              <select
                name="serviceId"
                required
                value={serviceId}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  const nextBarber = shop.barbers.find((barber) =>
                    barber.serviceIds.includes(event.target.value),
                  );
                  setBarberId(nextBarber?.id ?? "");
                  resetSlot();
                }}
                className={inputClasses()}
              >
                {eligibleServices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} · {item.duration_minutes} {t("minutes")}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t("barber")}
              <select
                name="barberId"
                required
                value={barberId}
                onChange={(event) => {
                  setBarberId(event.target.value);
                  resetSlot();
                }}
                className={inputClasses()}
              >
                {eligibleBarbers.map((barber) => (
                  <option key={barber.id} value={barber.id}>
                    {barber.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              {t("date")}
              <input
                type="date"
                name="date"
                required
                min={today}
                max={lastBookableDate}
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  resetSlot();
                }}
                className={inputClasses()}
              />
            </label>
            <button
              type="submit"
              disabled={loadingSlots || !serviceId || !barberId || !date}
              className={buttonClasses("primary", "md", "qassa-cta sm:col-span-3 sm:w-fit")}
            >
              {loadingSlots ? t("searching") : t("showTimes")}
            </button>
          </form>

          {serviceId && eligibleBarbers.length === 0 && (
            <p role="status" className="text-sm opacity-80">
              {t("noMatchingBarbers")}
            </p>
          )}

          {service && (
            <p className="text-sm opacity-80">
              {t("servicePrice")}:{" "}
              {new Intl.NumberFormat(locale, {
                style: "currency",
                currency: "TND",
                minimumFractionDigits: 0,
                maximumFractionDigits: 3,
              }).format(service.price_tnd)}
            </p>
          )}

          {slotsState.error &&
            (!slotsState.requested ||
              (slotsState.requested.serviceId === serviceId &&
                slotsState.requested.barberId === barberId &&
                slotsState.requested.date === date)) && (
              <Feedback state={{ error: slotsState.error }} />
            )}

          {loadingSlots && (
            <div aria-hidden="true" className="flex flex-wrap gap-2">
              {SKELETON_SIZES.map((size, index) => (
                <span
                  key={index}
                  className={`qassa-skeleton rounded-lg ${size}`}
                />
              ))}
            </div>
          )}

          {slotsMatchSelection && !slotsState.error && (
              <fieldset className="grid gap-3">
                <legend className="font-semibold">
                  {t("availableTimes")} · {formatDate.format(new Date(`${date}T12:00:00Z`))}
                </legend>
                {currentSlots.length === 0 ? (
                  <p role="status" className="text-sm opacity-80">
                    {t("noAvailableTimes")}
                  </p>
                ) : (
                  <div className="qassa-stagger flex flex-wrap gap-2">
                    {currentSlots.map((slot) => (
                      <label
                        key={slot}
                        className={`qassa-slot inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${selectedSlot === slot ? "border-current bg-white/10 font-semibold shadow-sm" : "border-border hover:border-current"}`}
                      >
                        <input
                          type="radio"
                          name="selectedSlot"
                          value={slot}
                          checked={selectedSlot === slot}
                          onChange={() => {
                            setSelectedSlot(slot);
                            setIdempotencyKey(crypto.randomUUID());
                          }}
                        />
                        <span dir="ltr">{formatTime.format(new Date(slot))}</span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            )}

          {selectedSlot && !booked && (
            <form action={bookingAction} className="grid gap-3 border-t border-border pt-5">
              <input type="hidden" name="shopId" value={shop.id} />
              <input type="hidden" name="serviceId" value={serviceId} />
              <input type="hidden" name="barberId" value={barberId} />
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="startsAt" value={selectedSlot} />
              <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
              {needsLogin && (
                <p className="text-sm opacity-80">{t("signInBeforeBooking")}</p>
              )}
              {bookingState.error && <Feedback state={bookingState} />}
              <button
                type="submit"
                disabled={needsLogin || submittingBooking || !idempotencyKey}
                className={buttonClasses("primary", "lg", "qassa-cta sm:w-fit")}
              >
                {submittingBooking ? t("booking") : t("confirmBooking")}
              </button>
              {needsLogin && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <Link href={loginHref} className="underline underline-offset-4">
                    {t("login")}
                  </Link>
                  <Link href={registerHref} className="underline underline-offset-4">
                    {t("createAccount")}
                  </Link>
                </div>
              )}
            </form>
          )}

          {booked && (
            <div
              role="status"
              className="grid gap-3 rounded-xl border border-success/30 bg-success/10 p-5"
            >
              <div className="flex items-start gap-3">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="qassa-check size-7 shrink-0 text-success"
                >
                  <circle pathLength="1" cx="12" cy="12" r="10" className="opacity-25" />
                  <path pathLength="1" d="M8 12.5 11 15.5 16.5 9.5" />
                </svg>
                <p className="font-semibold">{t("bookingConfirmed")}</p>
              </div>
              <p className="text-sm">
                {formatDate.format(new Date(selectedSlot))} ·{" "}
                {formatTime.format(new Date(selectedSlot))}
              </p>
              <p className="text-sm opacity-80">{t("confirmationReference")}: {bookingState.appointmentId}</p>
              <Link
                href="/account/appointments"
                className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
              >
                {t("viewMyAppointments")}
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
