"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import {
  deleteStudioSchedule,
  saveBarberSchedule,
  saveBusinessHours,
  type StudioActionState,
} from "@/lib/actions/studio";
import { StudioActionFeedback } from "@/components/studio/studio-action-feedback";
import type { StudioBarber } from "@/components/studio/barber-editor";

export type StudioBusinessHour = {
  id: string;
  weekday: number;
  opens_at: string;
  closes_at: string;
};

export type StudioBarberSchedule = {
  id: string;
  barber_id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
};

function WeekdaySelect({
  name = "weekday",
  defaultValue = 1,
}: {
  name?: string;
  defaultValue?: number;
}) {
  const t = useTranslations("studio.weekdays");

  return (
    <select
      name={name}
      defaultValue={String(defaultValue)}
      className={inputClasses()}
    >
      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
        <option key={day} value={day}>
          {t(String(day))}
        </option>
      ))}
    </select>
  );
}

function RemoveScheduleForm({
  shopId,
  recordId,
  kind,
}: {
  shopId: string;
  recordId: string;
  kind: "hours" | "schedule";
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    deleteStudioSchedule,
    {},
  );

  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="shopId" value={shopId} />
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="kind" value={kind} />
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("outline", "sm")}
      >
        {pending ? t("saving") : t("removeSchedule")}
      </button>
      <StudioActionFeedback state={state} />
    </form>
  );
}

function BusinessHoursForm({
  shopId,
  hours,
}: {
  shopId: string;
  hours?: StudioBusinessHour;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveBusinessHours,
    {},
  );

  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <input type="hidden" name="shopId" value={shopId} />
      {hours && <input type="hidden" name="hoursId" value={hours.id} />}
      <label className="grid gap-2 text-sm font-medium">
        {t("weekday")}
        <WeekdaySelect defaultValue={hours?.weekday ?? 1} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("opensAt")}
        <input
          type="time"
          name="opensAt"
          required
          defaultValue={hours?.opens_at.slice(0, 5) ?? "09:00"}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("closesAt")}
        <input
          type="time"
          name="closesAt"
          required
          defaultValue={hours?.closes_at.slice(0, 5) ?? "18:00"}
          className={inputClasses()}
        />
      </label>
      <div className="grid gap-2">
        <span className="invisible hidden text-sm lg:block">{t("opensAt")}</span>
        <button
          type="submit"
          disabled={pending}
          className={buttonClasses("primary", "md")}
        >
          {pending ? t("saving") : hours ? t("saveChanges") : t("addHours")}
        </button>
      </div>
      <div className="sm:col-span-2 lg:col-span-4">
        <StudioActionFeedback state={state} />
      </div>
    </form>
  );
}

function BarberScheduleForm({
  shopId,
  barbers,
  schedule,
  defaultBarberId,
}: {
  shopId: string;
  barbers: StudioBarber[];
  schedule?: StudioBarberSchedule;
  defaultBarberId?: string;
}) {
  const t = useTranslations("studio");
  const [state, formAction, pending] = useActionState<StudioActionState, FormData>(
    saveBarberSchedule,
    {},
  );

  return (
    <form action={formAction} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
      <input type="hidden" name="shopId" value={shopId} />
      {schedule && (
        <input type="hidden" name="scheduleId" value={schedule.id} />
      )}
      <label className="grid gap-2 text-sm font-medium">
        {t("barber")}
        <select
          name="barberId"
          required
          defaultValue={schedule?.barber_id ?? defaultBarberId}
          className={inputClasses()}
        >
          {barbers.map((barber) => (
            <option key={barber.id} value={barber.id}>
              {barber.display_name}
              {!barber.is_active ? ` (${t("inactive")})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("weekday")}
        <WeekdaySelect defaultValue={schedule?.weekday ?? 1} />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("startsAt")}
        <input
          type="time"
          name="startsAt"
          required
          defaultValue={schedule?.starts_at.slice(0, 5) ?? "09:00"}
          className={inputClasses()}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("endsAt")}
        <input
          type="time"
          name="endsAt"
          required
          defaultValue={schedule?.ends_at.slice(0, 5) ?? "18:00"}
          className={inputClasses()}
        />
      </label>
      <div className="grid gap-2">
        <span className="invisible hidden text-sm lg:block">{t("startsAt")}</span>
        <button
          type="submit"
          disabled={pending || barbers.length === 0}
          className={buttonClasses("primary", "md")}
        >
          {pending ? t("saving") : schedule ? t("saveChanges") : t("addSchedule")}
        </button>
      </div>
      <div className="sm:col-span-2 lg:col-span-5">
        <StudioActionFeedback state={state} />
      </div>
    </form>
  );
}

export function ScheduleEditor({
  shopId,
  hours,
  barbers,
  schedules,
}: {
  shopId: string;
  hours: StudioBusinessHour[];
  barbers: StudioBarber[];
  schedules: StudioBarberSchedule[];
}) {
  const t = useTranslations("studio");

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div>
          <h2 className="font-display text-xl font-semibold">{t("shopHoursTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("shopHoursDescription")}
          </p>
        </div>
        <div className="grid gap-5">
          {hours.map((row) => (
            <article
              key={row.id}
              className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <BusinessHoursForm shopId={shopId} hours={row} />
              <RemoveScheduleForm shopId={shopId} recordId={row.id} kind="hours" />
            </article>
          ))}
          {hours.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("noShopHoursYet")}</p>
          )}
        </div>
        <div className="border-t border-border pt-6">
          <h3 className="mb-4 font-semibold">{t("addHours")}</h3>
          <BusinessHoursForm shopId={shopId} />
        </div>
      </section>

      <section className="grid gap-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div>
          <h2 className="font-display text-xl font-semibold">{t("barberScheduleTitle")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("barberScheduleDescription")}
          </p>
        </div>
        {barbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("createBarberFirst")}</p>
        ) : (
          <div className="grid gap-5">
            {barbers.map((barber) => {
              const barberSchedules = schedules.filter(
                (schedule) => schedule.barber_id === barber.id,
              );
              return (
                <article
                  key={barber.id}
                  className="grid gap-4 rounded-xl border border-border p-4"
                >
                  <h3 className="font-semibold">
                    {barber.display_name}
                    {!barber.is_active && (
                      <span className="ms-2 text-sm font-normal text-muted-foreground">
                        {t("inactive")}
                      </span>
                    )}
                  </h3>
                  {barberSchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="grid gap-4 border-t border-border pt-4 md:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      <BarberScheduleForm
                        shopId={shopId}
                        barbers={barbers}
                        schedule={schedule}
                      />
                      <RemoveScheduleForm
                        shopId={shopId}
                        recordId={schedule.id}
                        kind="schedule"
                      />
                    </div>
                  ))}
                  {barberSchedules.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("noBarberSchedulesYet")}
                    </p>
                  )}
                  <div className="border-t border-border pt-4">
                    <h4 className="mb-4 text-sm font-medium">{t("addSchedule")}</h4>
                    <BarberScheduleForm
                      shopId={shopId}
                      barbers={barbers}
                      defaultBarberId={barber.id}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
