import { getLocale, getTranslations } from "next-intl/server";
import { CustomerAppointments, type CustomerAppointment } from "@/components/booking/customer-appointments";
import { Link, redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function CustomerAppointmentsPage() {
  const [locale, t] = await Promise.all([
    getLocale(),
    getTranslations("account"),
  ]);
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user || userError) {
    return redirect({
      href: `/login?next=${encodeURIComponent(`/${locale}/account/appointments`)}`,
      locale,
    });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  const { data: appointmentRows, error: appointmentsError } = await supabase
    .from("appointments")
    .select(
      "id, shop_id, barber_id, starts_at, ends_at, status, customer_note, cancellation_reason",
    )
    .eq("customer_id", user.id)
    .gte("starts_at", cutoff)
    .order("starts_at", { ascending: true })
    .limit(100);

  if (appointmentsError) {
    console.error("Failed to load customer appointments", appointmentsError);
    return (
      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-12">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("loadError")}
        </p>
        <Link href="/discover" className="text-sm font-medium underline underline-offset-4">
          {t("discoverShops")}
        </Link>
      </main>
    );
  }

  const appointments = appointmentRows ?? [];
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const shopIds = [...new Set(appointments.map((appointment) => appointment.shop_id))];
  const barberIds = [...new Set(appointments.map((appointment) => appointment.barber_id))];
  const [serviceResult, shopResult, barberResult] = await Promise.all([
    appointmentIds.length
      ? supabase
          .from("appointment_services")
          .select("appointment_id, service_name, duration_minutes, price_tnd")
          .in("appointment_id", appointmentIds)
      : Promise.resolve({ data: [], error: null }),
    shopIds.length
      ? supabase
          .from("public_barbershops")
          .select("id, name")
          .in("id", shopIds)
      : Promise.resolve({ data: [], error: null }),
    barberIds.length
      ? supabase.from("barbers").select("id, display_name").in("id", barberIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (serviceResult.error) console.error("Failed to load customer appointment services", serviceResult.error);
  if (shopResult.error) console.error("Failed to load customer appointment shops", shopResult.error);
  if (barberResult.error) console.error("Failed to load customer appointment barbers", barberResult.error);
  if (serviceResult.error || shopResult.error || barberResult.error) {
    return (
      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-12">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("loadError")}
        </p>
        <Link href="/discover" className="text-sm font-medium underline underline-offset-4">
          {t("discoverShops")}
        </Link>
      </main>
    );
  }

  const shopNames = new Map((shopResult.data ?? []).map((shop) => [shop.id, shop.name]));
  const barberNames = new Map(
    (barberResult.data ?? []).map((barber) => [barber.id, barber.display_name]),
  );
  const servicesByAppointment = new Map<
    string,
    CustomerAppointment["services"]
  >();
  for (const service of serviceResult.data ?? []) {
    const services = servicesByAppointment.get(service.appointment_id) ?? [];
    services.push({
      name: service.service_name,
      duration_minutes: service.duration_minutes,
      price_tnd: Number(service.price_tnd),
    });
    servicesByAppointment.set(service.appointment_id, services);
  }

  const customerAppointments: CustomerAppointment[] = appointments.map((appointment) => ({
    id: appointment.id,
    starts_at: appointment.starts_at,
    ends_at: appointment.ends_at,
    status: appointment.status,
    customer_note: appointment.customer_note,
    cancellation_reason: appointment.cancellation_reason,
    shop_name: shopNames.get(appointment.shop_id) ?? t("shopUnavailable"),
    barber_name: barberNames.get(appointment.barber_id) ?? t("barberUnavailable"),
    services: servicesByAppointment.get(appointment.id) ?? [],
  }));

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-12">
      <header className="grid gap-3">
        <Link href="/discover" className="text-sm font-medium underline underline-offset-4">
          {t("discoverShops")}
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </header>
      <CustomerAppointments
        appointments={customerAppointments}
        locale={locale}
        currentTime={nowIso}
      />
    </main>
  );
}
