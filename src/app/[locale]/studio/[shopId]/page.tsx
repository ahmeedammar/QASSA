import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Link, redirect } from "@/i18n/navigation";
import {
  AvailabilityExceptionsEditor,
  type StudioBarberBreak,
  type StudioBarberDayOff,
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
import { ShopMediaEditor, type ShopMedia } from "@/components/studio/shop-media-editor";
import { StudioSetupNav, type StudioSetupStep } from "@/components/studio/studio-setup-nav";
import {
  WebsiteSettingsEditor,
  type WebsiteSettings,
} from "@/components/studio/website-settings-editor";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

const SETUP_STEPS = ["services", "team", "hours", "exceptions", "media", "site"] as const;
type SetupStep = (typeof SETUP_STEPS)[number];

// Which publication requirements each step is responsible for. A step whose
// list is complete is marked as done in the progress rail.
const STEP_REQUIREMENTS: Record<SetupStep, string[]> = {
  services: ["services"],
  team: ["barber_services"],
  hours: ["shop_hours", "barber_schedules", "rest_day"],
  exceptions: [],
  media: ["shop_media"],
  site: [],
};

const SHOP_COLUMNS =
  "id, name, slug, city, address, phone, description, template_id, logo_path, cover_path, gallery_paths, is_published, is_suspended, closed_weekday";

export default async function StudioShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; shopId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const [{ shopId }, { step: rawStep }, locale, t] = await Promise.all([
    params,
    searchParams,
    getLocale(),
    getTranslations("studio"),
  ]);
  const step: SetupStep = SETUP_STEPS.includes(rawStep as SetupStep)
    ? (rawStep as SetupStep)
    : "services";

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (!user || userError) return redirect({ href: "/login", locale });

  const [
    { data: shopRow, error: shopError },
    { data: membership, error: membershipError },
    { data: requirementRows, error: requirementsError },
  ] = await Promise.all([
    supabase.from("barbershops").select(SHOP_COLUMNS).eq("id", shopId).maybeSingle(),
    supabase
      .from("shop_members")
      .select("role")
      .eq("shop_id", shopId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle(),
    supabase.rpc("shop_website_missing_requirements", { p_shop_id: shopId }),
  ]);

  if (shopError) console.error("Failed to load Studio shop", shopError);
  if (membershipError) console.error("Failed to verify Studio shop access", membershipError);
  if (requirementsError) console.error("Failed to load shop setup requirements", requirementsError);
  if (membershipError || !membership || !["owner", "manager"].includes(membership.role)) {
    notFound();
  }
  if (!shopRow) notFound();

  const shop = shopRow as WebsiteSettings & {
    logo_path: string | null;
    cover_path: string | null;
    gallery_paths: string[] | null;
    closed_weekday: number | null;
  };
  const missing = requirementsError
    ? ["services", "barber_services", "shop_hours", "barber_schedules", "shop_media", "rest_day"]
    : (requirementRows as string[] | null) ?? [];

  const steps: StudioSetupStep[] = SETUP_STEPS.map((id) => ({
    id,
    label: t(`setupSteps.${id}`),
    done:
      STEP_REQUIREMENTS[id].length === 0
        ? id === "site"
          ? shop.is_published
          : true
        : STEP_REQUIREMENTS[id].every((requirement) => !missing.includes(requirement)),
  }));

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
            {t("setupStepDescription", { step: t(`setupSteps.${step}`) })}
          </p>
        </div>
        <Link
          href={`/studio/${shop.id}/appointments`}
          className="inline-flex w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("appointmentsTitle")}
        </Link>
      </header>

      <StudioSetupNav
        shopId={shop.id}
        steps={steps}
        current={step}
        caption={t("shopSetupDescription")}
        progressLabel={(done, total) => t("setupProgress", { done, total })}
      />

      <SetupPanel step={step} shop={shop} supabase={supabase} />

      <StepPager step={step} steps={steps} shopId={shop.id} />
    </main>
  );
}

async function SetupPanel({
  step,
  shop,
  supabase,
}: {
  step: SetupStep;
  shop: WebsiteSettings & {
    logo_path: string | null;
    cover_path: string | null;
    gallery_paths: string[] | null;
    closed_weekday: number | null;
  };
  supabase: Awaited<ReturnType<typeof createClient>>;
}) {
  const t = await getTranslations("studio");
  const shopId = shop.id;

  const queries = {
    services: supabase
      .from("shop_services")
      .select("id, name, description, duration_minutes, buffer_minutes, price_tnd, is_active")
      .eq("shop_id", shopId)
      .order("display_order")
      .order("name"),
    barbers: supabase
      .from("barbers")
      .select("id, display_name, bio, avatar_path, is_active")
      .eq("shop_id", shopId)
      .order("display_order")
      .order("display_name"),
    assignments: supabase
      .from("barber_services")
      .select("barber_id, service_id")
      .eq("shop_id", shopId),
    hours: supabase
      .from("shop_business_hours")
      .select("id, weekday, opens_at, closes_at")
      .eq("shop_id", shopId)
      .order("weekday")
      .order("opens_at"),
    schedules: supabase
      .from("barber_schedules")
      .select("id, barber_id, weekday, starts_at, ends_at")
      .eq("shop_id", shopId)
      .order("weekday")
      .order("starts_at"),
    breaks: supabase
      .from("barber_breaks")
      .select("id, barber_id, weekday, starts_at, ends_at")
      .eq("shop_id", shopId)
      .order("weekday")
      .order("starts_at"),
    daysOff: supabase
      .from("barber_days_off")
      .select("id, barber_id, starts_on, ends_on, reason")
      .eq("shop_id", shopId)
      .order("starts_on"),
  };

  const needed: (keyof typeof queries)[] =
    step === "services"
      ? ["services"]
      : step === "team"
        ? ["barbers", "services", "assignments"]
        : step === "hours"
          ? ["barbers", "hours", "schedules"]
          : step === "exceptions"
            ? ["barbers", "breaks", "daysOff"]
            : [];

  const results = await Promise.all(needed.map((key) => queries[key]));
  const failed = results.filter((result) => result.error);
  for (const result of failed) console.error("Failed to load Studio shop setup data", result.error);
  if (failed.length > 0) {
    return (
      <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
        {t("managementLoadError")}
      </p>
    );
  }

  const rows = Object.fromEntries(
    needed.map((key, index) => [key, results[index].data ?? []]),
  ) as Partial<Record<keyof typeof queries, unknown[]>>;

  const barbers: StudioBarber[] = (rows.barbers as StudioBarber[] | undefined) ?? [];
  const services: StudioService[] = (
    (rows.services as StudioService[] | undefined) ?? []
  ).map((service) => ({ ...service, price_tnd: Number(service.price_tnd) }));

  if (step === "services") {
    return <ServiceEditor shopId={shopId} services={services} />;
  }
  if (step === "team") {
    return (
      <BarberEditor
        shopId={shopId}
        barbers={barbers}
        services={services}
        assignments={(rows.assignments as { barber_id: string; service_id: string }[]) ?? []}
      />
    );
  }
  if (step === "hours") {
    return (
      <ScheduleEditor
        shopId={shopId}
        hours={(rows.hours as StudioBusinessHour[]) ?? []}
        barbers={barbers}
        schedules={(rows.schedules as StudioBarberSchedule[]) ?? []}
        restDay={shop.closed_weekday}
      />
    );
  }
  if (step === "exceptions") {
    return (
      <AvailabilityExceptionsEditor
        shopId={shopId}
        barbers={barbers}
        breaks={(rows.breaks as StudioBarberBreak[]) ?? []}
        daysOff={(rows.daysOff as StudioBarberDayOff[]) ?? []}
      />
    );
  }
  if (step === "media") {
    const media: ShopMedia = {
      logo_path: shop.logo_path ?? null,
      cover_path: shop.cover_path ?? null,
      gallery_paths: shop.gallery_paths ?? [],
    };
    return <ShopMediaEditor shopId={shopId} shopName={shop.name} media={media} />;
  }
  return <WebsiteSettingsEditor shop={shop} />;
}

async function StepPager({
  step,
  steps,
  shopId,
}: {
  step: SetupStep;
  steps: StudioSetupStep[];
  shopId: string;
}) {
  const index = SETUP_STEPS.indexOf(step);
  const next = steps[index + 1];
  if (!next) return null;
  const t = await getTranslations("studio");

  return (
    <div className="flex justify-end border-t border-border pt-6">
      <Link
        href={`/studio/${shopId}?step=${next.id}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
      >
        {t("nextStep")}
        <span aria-hidden="true" className="qassa-arrow">
          →
        </span>
        {next.label}
      </Link>
    </div>
  );
}
