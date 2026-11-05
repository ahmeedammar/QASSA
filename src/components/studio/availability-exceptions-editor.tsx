"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";
import type { StudioBarber } from "@/components/studio/barber-editor";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import {
  deleteStudioException,
  saveBarberBreak,
  saveBarberDayOff,
  saveShopHoliday,
  type StudioActionState,
} from "@/lib/actions/studio";

export type StudioBarberBreak = {
  id: string;
  barber_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
};

export type StudioBarberDayOff = {
  id: string;
  barber_id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
};

export type StudioShopHoliday = {
  id: string;
  holiday_date: string;
  reason: string | null;
};

function WeekdaySelect({ defaultValue = 1 }: { defaultValue?: number }) {
  const t = useTranslations("studio.weekdays");

  return (
    <select name="weekday" defaultValue={String(defaultValue)} className={inputClasses()}>
      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
        <option key={day} value={day}>
          {t(String(day))}
        </option>
      ))}
    </select>
  );
}

function ExceptionRemoveForm({
  shopId,
  recordId,
  kind,
}: {
  shopId: string;
  recordId: string;
  kind: "break" | "day_off" | "holiday";
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    deleteStudioException,
    {},
  );

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="kind" value={kind} />
      <button type="submit" disabled={pending} className={buttonClasses("outline", "sm")}>
        {pending ? t("saving") : t("removeSchedule")}
      </button>
      <StudioActionFeedback state={state} />
    </form>
  );
}

function BarberBreakForm({
  shopId,
  barberId,
  breakRow,
}: {
  shopId: string;
  barberId: string;
  breakRow?: StudioBarberBreak;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveBarberBreak,
    {},
  );

  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="barberId" value={barberId} />
      {breakRow && <input type="hidden" name="breakId" value={breakRow.id} />}
      <label className="grid gap-2 text-sm font-medium">
        {t("weekday")}
        <WeekdaySelect defaultValue={breakRow?.weekday ?? 1} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("startsAt")}
        <input
          type="time"
          name="startsAt"
          required
          defaultValue={breakRow?.starts_at.slice(0, 5) ?? "12:00"}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("endsAt")}
        <input
          type="time"
          name="endsAt"
          required
          defaultValue={breakRow?.ends_at.slice(0, 5) ?? "13:00"}
          className={inputClasses()}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
        {pending ? t("saving") : breakRow ? t("saveChanges") : t("addBreak")}
      </button>
      <div className="sm:col-span-2 lg:col-span-4">
        <StudioActionFeedback state={state} />
      </div>
    </form>
  );
}

function BarberDayOffForm({
  shopId,
  barberId,
  dayOff,
}: {
  shopId: string;
  barberId: string;
  dayOff?: StudioBarberDayOff;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveBarberDayOff,
    {},
  );

  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto]">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="barberId" value={barberId} />
      {dayOff && <input type="hidden" name="dayOffId" value={dayOff.id} />}
      <label className="grid gap-2 text-sm font-medium">
        {t("startsOn")}
        <input
          type="date"
          name="startsOn"
          required
          defaultValue={dayOff?.starts_on ?? ""}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("endsOn")}
        <input
          type="date"
          name="endsOn"
          required
          defaultValue={dayOff?.ends_on ?? ""}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("reasonOptional")}
        <input
          type="text"
          name="reason"
          maxLength={250}
          defaultValue={dayOff?.reason ?? ""}
          className={inputClasses()}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
        {pending ? t("saving") : dayOff ? t("saveChanges") : t("addTimeOff")}
      </button>
      <div className="sm:col-span-2 lg:col-span-4">
        <StudioActionFeedback state={state} />
      </div>
    </form>
  );
}

function ShopHolidayForm({
  shopId,
  holiday,
}: {
  shopId: string;
  holiday?: StudioShopHoliday;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveShopHoliday,
    {},
  );

  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_2fr_auto]">
      <input type="hidden" name="shopId" value={shopId} />
      {holiday && <input type="hidden" name="holidayId" value={holiday.id} />}
      <label className="grid gap-2 text-sm font-medium">
        {t("holidayDate")}
        <input
          type="date"
          name="holidayDate"
          required
          defaultValue={holiday?.holiday_date ?? ""}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("reasonOptional")}
        <input
          type="text"
          name="reason"
          maxLength={250}
          defaultValue={holiday?.reason ?? ""}
          className={inputClasses()}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md")}>
        {pending ? t("saving") : holiday ? t("saveChanges") : t("addHoliday")}
      </button>
      <div className="sm:col-span-2 lg:col-span-3">
        <StudioActionFeedback state={state} />
      </div>
    </form>
  );
}

export function AvailabilityExceptionsEditor({
  shopId,
  barbers,
  breaks,
  daysOff,
  holidays,
}: {
  shopId: string;
  barbers: StudioBarber[];
  breaks: StudioBarberBreak[];
  daysOff: StudioBarberDayOff[];
  holidays: StudioShopHoliday[];
}) {
  const t = useTranslations("studio");

  return (
    <section className="grid gap-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <header>
        <h2 className="font-display text-xl font-semibold">
          {t("availabilityExceptionsTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("availabilityExceptionsDescription")}
        </p>
      </header>

      <div className="grid gap-5">
        <div>
          <h3 className="font-semibold">{t("barberBreaksTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("barberBreaksDescription")}</p>
        </div>
        {barbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("createBarberFirst")}</p>
        ) : (
          barbers.map((barber) => {
            const barberBreaks = breaks.filter((row) => row.barber_id === barber.id);
            return (
              <article key={barber.id} className="grid gap-4 rounded-xl border border-border p-4">
                <h4 className="font-medium">{barber.display_name}</h4>
                {barberBreaks.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-4 border-t border-border pt-4 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <BarberBreakForm shopId={shopId} barberId={barber.id} breakRow={row} />
                    <ExceptionRemoveForm shopId={shopId} recordId={row.id} kind="break" />
                  </div>
                ))}
                {barberBreaks.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("noBarberBreaksYet")}</p>
                )}
                <div className="border-t border-border pt-4">
                  <BarberBreakForm shopId={shopId} barberId={barber.id} />
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="grid gap-5 border-t border-border pt-6">
        <div>
          <h3 className="font-semibold">{t("barberTimeOffTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("barberTimeOffDescription")}</p>
        </div>
        {barbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("createBarberFirst")}</p>
        ) : (
          barbers.map((barber) => {
            const barberDaysOff = daysOff.filter((row) => row.barber_id === barber.id);
            return (
              <article key={barber.id} className="grid gap-4 rounded-xl border border-border p-4">
                <h4 className="font-medium">{barber.display_name}</h4>
                {barberDaysOff.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-4 border-t border-border pt-4 md:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <BarberDayOffForm shopId={shopId} barberId={barber.id} dayOff={row} />
                    <ExceptionRemoveForm shopId={shopId} recordId={row.id} kind="day_off" />
                  </div>
                ))}
                {barberDaysOff.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t("noBarberTimeOffYet")}</p>
                )}
                <div className="border-t border-border pt-4">
                  <BarberDayOffForm shopId={shopId} barberId={barber.id} />
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="grid gap-5 border-t border-border pt-6">
        <div>
          <h3 className="font-semibold">{t("shopHolidaysTitle")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("shopHolidaysDescription")}</p>
        </div>
        {holidays.map((holiday) => (
          <article
            key={holiday.id}
            className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <ShopHolidayForm shopId={shopId} holiday={holiday} />
            <ExceptionRemoveForm shopId={shopId} recordId={holiday.id} kind="holiday" />
          </article>
        ))}
        {holidays.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("noShopHolidaysYet")}</p>
        )}
        <div className="border-t border-border pt-4">
          <ShopHolidayForm shopId={shopId} />
        </div>
      </div>
    </section>
  );
}
