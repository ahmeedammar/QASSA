"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { rateLimit } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import {
  deleteStudioExceptionSchema,
  deleteStudioScheduleSchema,
  saveBarberBreakSchema,
  saveBarberDayOffSchema,
  saveBarberScheduleSchema,
  saveBusinessHoursSchema,
  saveShopHolidaySchema,
  saveShopBarberSchema,
  saveShopMediaSchema,
  saveShopServiceSchema,
  setBarberServicesSchema,
  setShopContentActiveSchema,
  updateStudioAppointmentSchema,
} from "@/lib/validation/studio";
import { updateShopWebsiteSchema } from "@/lib/validation/shops";

export type StudioActionState = {
  error?: "invalid_input" | "too_many_requests" | "forbidden" | "slug_taken" | "already_exists" | "not_available" | "failed";
  success?: "saved";
  missing?: string[];
};

type StudioClient = Awaited<ReturnType<typeof createClient>>;

async function authorizeShopManager(
  supabase: StudioClient,
  shopId: string,
  userId: string,
): Promise<"authorized" | "forbidden" | "failed"> {
  const { data, error } = await supabase
    .from("shop_members")
    .select("role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to verify Studio shop membership", error);
    return "failed";
  }
  if (!data || (data.role !== "owner" && data.role !== "manager")) {
    return "forbidden";
  }
  return "authorized";
}

async function prepareStudioMutation(
  shopId: string,
): Promise<
  | { ok: true; supabase: StudioClient }
  | { ok: false; state: StudioActionState }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) redirect(`/${await getLocale()}/login`);

  const membership = await authorizeShopManager(supabase, shopId, user.id);
  if (membership !== "authorized") {
    return {
      ok: false,
      state: {
        error: membership === "failed" ? "failed" : "forbidden",
      },
    };
  }

  const limit = await rateLimit(`studio:${user.id}:${shopId}`, "admin");
  if (!limit.success) {
    return { ok: false, state: { error: "too_many_requests" } };
  }
  return { ok: true, supabase };
}

function revalidateStudio(shopId: string, locale: string) {
  revalidatePath(`/${locale}/studio`);
  revalidatePath(`/${locale}/studio/${shopId}`);
}

export async function saveShopWebsite(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = updateShopWebsiteSchema.safeParse({
    shopId: formData.get("shopId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    city: formData.get("city") ?? "",
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    description: formData.get("description") ?? "",
    templateId: formData.get("templateId"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { error } = await access.supabase.rpc("update_shop_website", {
    p_shop_id: parsed.data.shopId,
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_city: parsed.data.city,
    p_address: parsed.data.address,
    p_phone: parsed.data.phone,
    p_description: parsed.data.description,
    p_template_id: parsed.data.templateId,
  });

  if (error) {
    if (error.code === "23505") return { error: "slug_taken" };
    if (error.code === "42501") return { error: "forbidden" };
    if (error.code === "22023") return { error: "invalid_input" };
    console.error("Failed to save shop website settings", error);
    return { error: "failed" };
  }

  const locale = await getLocale();
  revalidateStudio(parsed.data.shopId, locale);
  revalidatePath(`/${locale}/shop/${parsed.data.slug}`);
  return { success: "saved" };
}

export async function saveShopMedia(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveShopMediaSchema.safeParse({
    shopId: formData.get("shopId"),
    logoPath: formData.get("logoPath") ?? "",
    coverPath: formData.get("coverPath") ?? "",
    galleryPaths: formData.getAll("galleryPaths"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { supabase } = access;
  const { data: previous } = await supabase
    .from("barbershops")
    .select("logo_path, cover_path, gallery_paths")
    .eq("id", parsed.data.shopId)
    .maybeSingle();
  const { error } = await supabase.rpc("update_shop_media", {
    p_shop_id: parsed.data.shopId,
    p_logo_path: parsed.data.logoPath,
    p_cover_path: parsed.data.coverPath,
    p_gallery_paths: parsed.data.galleryPaths,
  });

  if (error) {
    if (error.code === "42501") return { error: "forbidden" };
    if (error.code === "22023") return { error: "invalid_input" };
    if (error.code === "P0002") return { error: "not_available" };
    console.error("Failed to save shop media", error);
    return { error: "failed" };
  }

  // Objects that nothing points at any more. Deleting them here rather than in
  // the browser keeps a discarded edit from destroying a live image.
  const kept = new Set<string>([
    parsed.data.logoPath,
    parsed.data.coverPath,
    ...parsed.data.galleryPaths,
  ].filter((path): path is string => Boolean(path)));
  const retired = [
    previous?.logo_path,
    previous?.cover_path,
    ...(previous?.gallery_paths ?? []),
  ].filter((path): path is string => Boolean(path) && !kept.has(path));
  if (retired.length) {
    const { error: removeError } = await supabase
      .storage.from("shop-media")
      .remove(retired);
    if (removeError) console.error("Failed to prune replaced shop media", removeError);
  }

  const locale = await getLocale();
  revalidateStudio(parsed.data.shopId, locale);
  const { data: shop } = await supabase
    .from("barbershops")
    .select("slug")
    .eq("id", parsed.data.shopId)
    .maybeSingle();
  if (shop?.slug) revalidatePath(`/${locale}/shop/${shop.slug}`);
  return { success: "saved" };
}

export async function setShopPublished(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const shopId = formData.get("shopId");
  if (typeof shopId !== "string" || !z.string().uuid().safeParse(shopId).success) {
    return { error: "invalid_input" };
  }
  const shouldPublish = formData.get("publish") === "true";

  const access = await prepareStudioMutation(shopId);
  if (!access.ok) return access.state;
  const { data, error } = await access.supabase.rpc("set_shop_published", {
    p_shop_id: shopId,
    p_is_published: shouldPublish,
  });

  if (error) {
    if (error.code === "42501") return { error: "forbidden" };
    console.error("Failed to update shop publication", error);
    return { error: "failed" };
  }

  const result = z
    .object({
      published: z.boolean(),
      missing: z.array(
        z.enum([
          "services",
          "barber_services",
          "shop_hours",
          "barber_schedules",
          "shop_media",
        ]),
      ),
    })
    .safeParse(data);
  if (!result.success) {
    console.error("Shop publication RPC returned invalid data", result.error);
    return { error: "failed" };
  }
  if (result.data.missing.length) return { missing: result.data.missing };

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function saveShopService(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveShopServiceSchema.safeParse({
    shopId: formData.get("shopId"),
    serviceId: formData.get("serviceId") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    durationMinutes: formData.get("durationMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    priceTnd: formData.get("priceTnd"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { supabase } = access;
  const values = {
    name: parsed.data.name,
    description: parsed.data.description,
    duration_minutes: parsed.data.durationMinutes,
    buffer_minutes: parsed.data.bufferMinutes,
    price_tnd: parsed.data.priceTnd,
  };

  const result = parsed.data.serviceId
    ? await supabase
        .from("shop_services")
        .update(values)
        .eq("shop_id", parsed.data.shopId)
        .eq("id", parsed.data.serviceId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("shop_services")
        .insert({ ...values, shop_id: parsed.data.shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to save Studio service", result.error);
    return { error: "failed" };
  }

  revalidateStudio(parsed.data.shopId, await getLocale());
  return { success: "saved" };
}

export async function setShopServiceActive(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = setShopContentActiveSchema.safeParse({
    shopId: formData.get("shopId"),
    recordId: formData.get("recordId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { data, error } = await access.supabase
    .from("shop_services")
    .update({ is_active: parsed.data.active })
    .eq("shop_id", parsed.data.shopId)
    .eq("id", parsed.data.recordId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Failed to update Studio service status", error);
    return { error: "failed" };
  }

  revalidateStudio(parsed.data.shopId, await getLocale());
  return { success: "saved" };
}

export async function saveShopBarber(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveShopBarberSchema.safeParse({
    shopId: formData.get("shopId"),
    barberId: formData.get("barberId") || undefined,
    displayName: formData.get("displayName"),
    bio: formData.get("bio") ?? "",
    avatarPath: formData.get("avatarPath") ?? "",
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { supabase } = access;
  const { data: previousBarber } = parsed.data.barberId
    ? await supabase
        .from("barbers")
        .select("avatar_path")
        .eq("id", parsed.data.barberId)
        .maybeSingle()
    : { data: null };
  const values = {
    display_name: parsed.data.displayName,
    bio: parsed.data.bio,
    avatar_path: parsed.data.avatarPath,
  };

  const result = parsed.data.barberId
    ? await supabase
        .from("barbers")
        .update(values)
        .eq("shop_id", parsed.data.shopId)
        .eq("id", parsed.data.barberId)
        .select("id")
        .maybeSingle()
    : await supabase
        .from("barbers")
        .insert({ ...values, shop_id: parsed.data.shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to save Studio barber", result.error);
    return { error: "failed" };
  }

  if (previousBarber?.avatar_path && previousBarber.avatar_path !== parsed.data.avatarPath) {
    await supabase.storage.from("shop-media").remove([previousBarber.avatar_path]);
  }

  revalidateStudio(parsed.data.shopId, await getLocale());
  return { success: "saved" };
}

export async function setShopBarberActive(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = setShopContentActiveSchema.safeParse({
    shopId: formData.get("shopId"),
    recordId: formData.get("recordId"),
    active: formData.get("active"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { data, error } = await access.supabase
    .from("barbers")
    .update({ is_active: parsed.data.active })
    .eq("shop_id", parsed.data.shopId)
    .eq("id", parsed.data.recordId)
    .select("id")
    .maybeSingle();
  if (error || !data) {
    if (error) console.error("Failed to update Studio barber status", error);
    return { error: "failed" };
  }

  revalidateStudio(parsed.data.shopId, await getLocale());
  return { success: "saved" };
}

export async function saveBarberServices(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = setBarberServicesSchema.safeParse({
    shopId: formData.get("shopId"),
    barberId: formData.get("barberId"),
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { error } = await access.supabase.rpc("set_barber_services", {
    p_shop_id: parsed.data.shopId,
    p_barber_id: parsed.data.barberId,
    p_service_ids: parsed.data.serviceIds,
  });

  if (error) {
    if (error.code === "42501") return { error: "forbidden" };
    if (error.code === "22023") return { error: "invalid_input" };
    console.error("Failed to update barber service assignments", error);
    return { error: "failed" };
  }

  revalidateStudio(parsed.data.shopId, await getLocale());
  return { success: "saved" };
}

export async function saveBusinessHours(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveBusinessHoursSchema.safeParse({
    shopId: formData.get("shopId"),
    hoursId: formData.get("hoursId") || undefined,
    weekday: formData.get("weekday"),
    opensAt: formData.get("opensAt"),
    closesAt: formData.get("closesAt"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, hoursId, weekday, opensAt, closesAt } = parsed.data;
  const values = {
    weekday,
    opens_at: opensAt,
    closes_at: closesAt,
  };
  const result = hoursId
    ? await access.supabase
        .from("shop_business_hours")
        .update(values)
        .eq("shop_id", shopId)
        .eq("id", hoursId)
        .select("id")
        .maybeSingle()
    : await access.supabase
        .from("shop_business_hours")
        .insert({ ...values, shop_id: shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) {
      console.error("Failed to save shop business hours", result.error);
    }
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function saveBarberSchedule(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveBarberScheduleSchema.safeParse({
    shopId: formData.get("shopId"),
    scheduleId: formData.get("scheduleId") || undefined,
    barberId: formData.get("barberId"),
    weekday: formData.get("weekday"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, scheduleId, barberId, weekday, startsAt, endsAt } = parsed.data;
  const values = {
    barber_id: barberId,
    weekday,
    starts_at: startsAt,
    ends_at: endsAt,
  };
  const result = scheduleId
    ? await access.supabase
        .from("barber_schedules")
        .update(values)
        .eq("shop_id", shopId)
        .eq("id", scheduleId)
        .select("id")
        .maybeSingle()
    : await access.supabase
        .from("barber_schedules")
        .insert({ ...values, shop_id: shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to save barber schedule", result.error);
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function saveBarberBreak(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveBarberBreakSchema.safeParse({
    shopId: formData.get("shopId"),
    breakId: formData.get("breakId") || undefined,
    barberId: formData.get("barberId"),
    weekday: formData.get("weekday"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, breakId, barberId, weekday, startsAt, endsAt } = parsed.data;
  const values = {
    barber_id: barberId,
    weekday,
    starts_at: startsAt,
    ends_at: endsAt,
  };
  const result = breakId
    ? await access.supabase
        .from("barber_breaks")
        .update(values)
        .eq("shop_id", shopId)
        .eq("id", breakId)
        .select("id")
        .maybeSingle()
    : await access.supabase
        .from("barber_breaks")
        .insert({ ...values, shop_id: shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to save barber break", result.error);
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function saveBarberDayOff(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveBarberDayOffSchema.safeParse({
    shopId: formData.get("shopId"),
    dayOffId: formData.get("dayOffId") || undefined,
    barberId: formData.get("barberId"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, dayOffId, barberId, startsOn, endsOn, reason } = parsed.data;
  const values = {
    barber_id: barberId,
    starts_on: startsOn,
    ends_on: endsOn,
    reason,
  };
  const result = dayOffId
    ? await access.supabase
        .from("barber_days_off")
        .update(values)
        .eq("shop_id", shopId)
        .eq("id", dayOffId)
        .select("id")
        .maybeSingle()
    : await access.supabase
        .from("barber_days_off")
        .insert({ ...values, shop_id: shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to save barber time off", result.error);
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function saveShopHoliday(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = saveShopHolidaySchema.safeParse({
    shopId: formData.get("shopId"),
    holidayId: formData.get("holidayId") || undefined,
    holidayDate: formData.get("holidayDate"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, holidayId, holidayDate, reason } = parsed.data;
  const values = { holiday_date: holidayDate, reason };
  const result = holidayId
    ? await access.supabase
        .from("shop_holidays")
        .update(values)
        .eq("shop_id", shopId)
        .eq("id", holidayId)
        .select("id")
        .maybeSingle()
    : await access.supabase
        .from("shop_holidays")
        .insert({ ...values, shop_id: shopId })
        .select("id")
        .maybeSingle();

  if (result.error || !result.data) {
    if (result.error?.code === "23505") return { error: "already_exists" };
    if (result.error) console.error("Failed to save shop holiday", result.error);
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function deleteStudioException(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = deleteStudioExceptionSchema.safeParse({
    shopId: formData.get("shopId"),
    recordId: formData.get("recordId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, recordId, kind } = parsed.data;
  const result =
    kind === "break"
      ? await access.supabase
          .from("barber_breaks")
          .delete()
          .eq("shop_id", shopId)
          .eq("id", recordId)
          .select("id")
          .maybeSingle()
      : kind === "day_off"
        ? await access.supabase
            .from("barber_days_off")
            .delete()
            .eq("shop_id", shopId)
            .eq("id", recordId)
            .select("id")
            .maybeSingle()
        : await access.supabase
            .from("shop_holidays")
            .delete()
            .eq("shop_id", shopId)
            .eq("id", recordId)
            .select("id")
            .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to delete Studio availability exception", result.error);
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}

export async function updateStudioAppointment(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = updateStudioAppointmentSchema.safeParse({
    shopId: formData.get("shopId"),
    appointmentId: formData.get("appointmentId"),
    status: formData.get("status"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { data, error } = await access.supabase.rpc("manage_shop_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_status: parsed.data.status,
    p_reason: parsed.data.reason,
  });

  if (error) {
    if (error.code === "42501") return { error: "forbidden" };
    if (error.code === "22023") return { error: "invalid_input" };
    console.error("Failed to update Studio appointment", error);
    return { error: "failed" };
  }
  if (data !== true) return { error: "not_available" };

  const locale = await getLocale();
  revalidateStudio(parsed.data.shopId, locale);
  revalidatePath(`/${locale}/studio/${parsed.data.shopId}/appointments`);
  return { success: "saved" };
}

export async function deleteStudioSchedule(
  _previousState: StudioActionState,
  formData: FormData,
): Promise<StudioActionState> {
  const parsed = deleteStudioScheduleSchema.safeParse({
    shopId: formData.get("shopId"),
    recordId: formData.get("recordId"),
    kind: formData.get("kind"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await prepareStudioMutation(parsed.data.shopId);
  if (!access.ok) return access.state;
  const { shopId, recordId, kind } = parsed.data;
  const result =
    kind === "hours"
      ? await access.supabase
          .from("shop_business_hours")
          .delete()
          .eq("shop_id", shopId)
          .eq("id", recordId)
          .select("id")
          .maybeSingle()
      : await access.supabase
          .from("barber_schedules")
          .delete()
          .eq("shop_id", shopId)
          .eq("id", recordId)
          .select("id")
          .maybeSingle();

  if (result.error || !result.data) {
    if (result.error) console.error("Failed to delete Studio schedule row", result.error);
    return { error: "failed" };
  }

  revalidateStudio(shopId, await getLocale());
  return { success: "saved" };
}
