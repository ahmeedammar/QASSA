import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import {
  AvailabilityExceptionsEditor,
  type StudioBarberBreak,
  type StudioBarberDayOff,
  type StudioShopHoliday,
} from "@/components/studio/availability-exceptions-editor";
import { BarberEditor } from "@/components/studio/barber-editor";
import type { StudioBarber } from "@/components/studio/barber-editor";
import {
  ServiceEditor,
  type StudioService,
} from "@/components/studio/service-editor";
import {
  ScheduleEditor,
  type StudioBarberSchedule,
  type StudioBusinessHour,
} from "@/components/studio/schedule-editor";
import {
  WebsiteSettingsEditor,
  type WebsiteSettings,
} from "@/components/studio/website-settings-editor";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function StudioShopPage({
  params,
}: {
  params: Promise<{ locale: string; shopId: string }>;
}) {
  const [{ shopId }, locale, t] = await Promise.all([
    params,
    getLocale(),
    getTranslations("studio"),
  ]);
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user || userError) return redirect({ href: "/login", locale });

  const [{ data: shopRow, error: shopError }, { data: membership, error: membershipError }] =
    await Promise.all([
      supabase
        .from("barbershops")
        .select("id, name, slug, city, address, phone, description, template_id, is_published, is_suspended")
        .eq("id", shopId)
        .maybeSingle(),
      supabase
        .from("shop_members")
        .select("role")
        .eq("shop_id", shopId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  if (shopError) console.error("Failed to load Studio shop", shopError);
  if (membershipError) console.error("Failed to verify Studio shop access", membershipError);
  if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
    notFound();
  }
  if (!shopRow) notFound();
  const shop = shopRow as WebsiteSettings;

  const [
    { data: serviceRows, error: servicesError },
    { data: barberRows, error: barbersError },
    { data: assignments, error: assignmentsError },
    { data: hourRows, error: hoursError },
    { data: scheduleRows, error: schedulesError },
    { data: breakRows, error: breaksError },
    { data: dayOffRows, error: daysOffError },
    { data: holidayRows, error: holidaysError },
  ] = await Promise.all([
    supabase
      .from("shop_services")
      .select("id, name, description, duration_minutes, buffer_minutes, price_tnd, is_active")
      .eq("shop_id", shopId)
      .order("display_order")
      .order("name"),
    supabase
      .from("barbers")
      .select("id, display_name, bio, is_active")
      .eq("shop_id", shopId)
      .order("display_order")
      .order("display_name"),
    supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("shop_id", shopId),
    supabase
      .from("shop_business_hours")
      .select("id, weekday, opens_at, closes_at")
      .eq("shop_id", shopId)
      .order("weekday")
      .order("opens_at"),
    supabase
      .from("barber_schedules")
      .select("id, barber_id, weekday, starts_at, ends_at")
      .eq("shop_id", shopId)
      .order("weekday")
      .order("starts_at"),
    supabase
      .from("barber_breaks")
      .select("id, barber_id, weekday, starts_at, ends_at")
      .eq("shop_id", shopId)
      .order("weekday")
      .order("starts_at"),
    supabase
      .from("barber_days_off")
      .select("id, barber_id, starts_on, ends_on, reason")
      .eq("shop_id", shopId)
      .order("starts_on"),
    supabase
      .from("shop_holidays")
      .select("id, holiday_date, reason")
      .eq("shop_id", shopId)
      .order("holiday_date"),
  ]);

  if (servicesError) console.error("Failed to load Studio services", servicesError);
  if (barbersError) console.error("Failed to load Studio barbers", barbersError);
  if (assignmentsError) console.error("Failed to load barber service assignments", assignmentsError);
  if (hoursError) console.error("Failed to load shop business hours", hoursError);
  if (schedulesError) console.error("Failed to load barber schedules", schedulesError);
  if (breaksError) console.error("Failed to load barber breaks", breaksError);
  if (daysOffError) console.error("Failed to load barber time off", daysOffError);
  if (holidaysError) console.error("Failed to load shop holidays", holidaysError);
  if (
    servicesError ||
    barbersError ||
    assignmentsError ||
    hoursError ||
    schedulesError ||
    breaksError ||
    daysOffError ||
    holidaysError
  ) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("managementLoadError")}
        </p>
        <Link
          href="/studio"
          className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("backToStudio")}
        </Link>
      </main>
    );
  }

  const services: StudioService[] = (serviceRows ?? []).map((service) => ({
    ...service,
    price_tnd: Number(service.price_tnd),
  }));
  const barbers: StudioBarber[] = barberRows ?? [];
  const hours: StudioBusinessHour[] = hourRows ?? [];
  const schedules: StudioBarberSchedule[] = scheduleRows ?? [];
  const breaks: StudioBarberBreak[] = breakRows ?? [];
  const daysOff: StudioBarberDayOff[] = dayOffRows ?? [];
  const holidays: StudioShopHoliday[] = holidayRows ?? [];

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-12">
      <header className="grid gap-4">
        <Link
          href="/studio"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("backToStudio")}
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold">{shop.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {shop.is_suspended
              ? t("suspended")
              : shop.is_published
                ? t("published")
                : t("draft")}
            <span className="mx-2" aria-hidden="true">·</span>
            {t("shopSetupDescription")}
          </p>
        </div>
        <Link
          href={`/studio/${shop.id}/appointments`}
          className="inline-flex w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("appointmentsTitle")}
        </Link>
      </header>

      <ServiceEditor shopId={shop.id} services={services} />
      <BarberEditor
        shopId={shop.id}
        barbers={barbers}
        services={services}
        assignments={assignments ?? []}
      />
      <ScheduleEditor
        shopId={shop.id}
        hours={hours}
        barbers={barbers}
        schedules={schedules}
      />
      <AvailabilityExceptionsEditor
        shopId={shop.id}
        barbers={barbers}
        breaks={breaks}
        daysOff={daysOff}
        holidays={holidays}
      />
      <WebsiteSettingsEditor shop={shop} />
    </main>
  );
}
