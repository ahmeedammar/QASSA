import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import {
  AppointmentsEditor,
  type StudioAppointment,
} from "@/components/studio/appointments-editor";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function StudioAppointmentsPage({
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

  const [{ data: shop, error: shopError }, { data: membership, error: membershipError }] =
    await Promise.all([
      supabase.from("barbershops").select("id, name").eq("id", shopId).maybeSingle(),
      supabase
        .from("shop_members")
        .select("role")
        .eq("shop_id", shopId)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  if (shopError) console.error("Failed to load Studio appointments shop", shopError);
  if (membershipError) console.error("Failed to verify Studio appointments access", membershipError);
  if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
    notFound();
  }
  if (!shop) notFound();

  const now = new Date();
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  const [upcomingResult, recentResult, barberResult] = await Promise.all([
    supabase
      .from("appointments")
      .select("id, barber_id, customer_id, starts_at, ends_at, status, customer_note, cancellation_reason")
      .eq("shop_id", shopId)
      .gte("starts_at", nowIso)
      .order("starts_at")
      .limit(100),
    supabase
      .from("appointments")
      .select("id, barber_id, customer_id, starts_at, ends_at, status, customer_note, cancellation_reason")
      .eq("shop_id", shopId)
      .lt("starts_at", nowIso)
      .gte("starts_at", cutoff)
      .order("starts_at", { ascending: false })
      .limit(100),
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("shop_id", shopId),
  ]);

  const appointments = [...(upcomingResult.data ?? []), ...(recentResult.data ?? [])];
  const appointmentIds = appointments.map((appointment) => appointment.id);
  const servicesResult = appointmentIds.length
    ? await supabase
        .from("appointment_services")
        .select("appointment_id, service_name, duration_minutes, price_tnd")
        .eq("shop_id", shopId)
        .in("appointment_id", appointmentIds)
    : { data: [], error: null };

  if (upcomingResult.error) console.error("Failed to load upcoming appointments", upcomingResult.error);
  if (recentResult.error) console.error("Failed to load recent appointments", recentResult.error);
  if (barberResult.error) console.error("Failed to load appointment barbers", barberResult.error);
  if (servicesResult.error) console.error("Failed to load appointment service details", servicesResult.error);
  if (
    upcomingResult.error ||
    recentResult.error ||
    barberResult.error ||
    servicesResult.error
  ) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("managementLoadError")}
        </p>
        <Link
          href={`/studio/${shopId}`}
          className="mt-6 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("backToStudio")}
        </Link>
      </main>
    );
  }

  const barberNames = new Map(
    (barberResult.data ?? []).map((barber) => [barber.id, barber.display_name]),
  );
  const serviceRowsByAppointment = new Map<
    string,
    StudioAppointment["services"]
  >();
  for (const service of servicesResult.data ?? []) {
    const appointmentServices = serviceRowsByAppointment.get(service.appointment_id) ?? [];
    appointmentServices.push({
      name: service.service_name,
      duration_minutes: service.duration_minutes,
      price_tnd: Number(service.price_tnd),
    });
    serviceRowsByAppointment.set(service.appointment_id, appointmentServices);
  }

  const studioAppointments: StudioAppointment[] = appointments
    .map((appointment) => ({
      ...appointment,
      barber_name: barberNames.get(appointment.barber_id) ?? t("unknownBarber"),
      services: serviceRowsByAppointment.get(appointment.id) ?? [],
    }))
    .sort(
      (left, right) =>
        new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime(),
    );

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-12">
      <header className="grid gap-3">
        <Link
          href={`/studio/${shopId}`}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("backToShopManagement")}
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold">{shop.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("appointmentsDescription")}</p>
        </div>
      </header>
      <AppointmentsEditor
        shopId={shopId}
        appointments={studioAppointments}
        locale={locale}
        currentTime={nowIso}
      />
    </main>
  );
}
