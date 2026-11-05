"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  availableSlotsResultSchema,
  availableSlotsSchema,
  bookAppointmentSchema,
  cancelCustomerAppointmentSchema,
} from "@/lib/validation/booking";

export type BookingActionState = {
  error?: "invalid_input" | "too_many_requests" | "login_required" | "slot_unavailable" | "failed";
  slots?: string[];
  requested?: { serviceId: string; barberId: string; date: string };
  appointmentId?: string;
  bookedStartsAt?: string;
  success?: "booked" | "cancelled";
};

export async function getAvailableSlots(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = availableSlotsSchema.safeParse({
    shopId: formData.get("shopId"),
    barberId: formData.get("barberId"),
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
  });
  if (!parsed.success) return { error: "invalid_input" };
  const requested = {
    serviceId: parsed.data.serviceId,
    barberId: parsed.data.barberId,
    date: parsed.data.date,
  };

  const requestHeaders = await headers();
  const limit = await rateLimit(
    `${clientIp(requestHeaders)}:${parsed.data.shopId}`,
    "public",
  );
  if (!limit.success) return { error: "too_many_requests", requested };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_shop_id: parsed.data.shopId,
    p_barber_id: parsed.data.barberId,
    p_service_id: parsed.data.serviceId,
    p_date: parsed.data.date,
  });
  if (error) {
    console.error("Failed to load customer booking availability", error);
    return { error: "failed", requested };
  }

  const result = availableSlotsResultSchema.safeParse(data);
  if (!result.success) {
    console.error("Availability RPC returned invalid data", result.error);
    return { error: "failed", requested };
  }

  return {
    slots: result.data.map((slot) => slot.slot_start),
    requested,
  };
}

export async function bookAppointment(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = bookAppointmentSchema.safeParse({
    shopId: formData.get("shopId"),
    barberId: formData.get("barberId"),
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
    startsAt: formData.get("startsAt"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    console.error("Failed to verify customer before booking", userError);
    return { error: "failed" };
  }
  if (!user) return { error: "login_required" };

  const limit = await rateLimit(`booking:${user.id}:${parsed.data.shopId}`, "booking");
  if (!limit.success) return { error: "too_many_requests" };

  const { data, error } = await supabase.rpc("book_appointment", {
    p_shop_id: parsed.data.shopId,
    p_barber_id: parsed.data.barberId,
    p_service_id: parsed.data.serviceId,
    p_starts_at: parsed.data.startsAt,
    p_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    if (error.code === "P0001" || error.code === "23P01") {
      return { error: "slot_unavailable" };
    }
    if (error.code === "28000") return { error: "login_required" };
    if (error.code === "22023") return { error: "invalid_input" };
    console.error("Failed to create customer appointment", error);
    return { error: "failed" };
  }

  const appointmentId = z.string().uuid().safeParse(data);
  if (!appointmentId.success) {
    console.error("Booking RPC returned an invalid appointment ID", appointmentId.error);
    return { error: "failed" };
  }
  return {
    success: "booked",
    appointmentId: appointmentId.data,
    bookedStartsAt: parsed.data.startsAt,
  };
}

export async function cancelCustomerAppointment(
  _previousState: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = cancelCustomerAppointmentSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    console.error("Failed to verify customer before cancellation", userError);
    return { error: "failed" };
  }
  if (!user) {
    const locale = await getLocale();
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/account/appointments`)}`,
    );
  }

  const limit = await rateLimit(`booking:${user.id}`, "booking");
  if (!limit.success) return { error: "too_many_requests" };

  const { data, error } = await supabase.rpc("cancel_appointment", {
    p_appointment_id: parsed.data.appointmentId,
    p_reason: null,
  });
  if (error) {
    if (error.code === "28000") {
      const locale = await getLocale();
      redirect(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/account/appointments`)}`,
      );
    }
    console.error("Failed to cancel customer appointment", error);
    return { error: "failed" };
  }
  if (typeof data !== "boolean") {
    console.error("Cancellation RPC returned invalid data", data);
    return { error: "failed" };
  }
  if (!data) return { error: "slot_unavailable" };

  revalidatePath(`/${await getLocale()}/account/appointments`);
  return { success: "cancelled" };
}
