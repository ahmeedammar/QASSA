import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bookAppointment,
  cancelCustomerAppointment,
  getAvailableSlots,
} from "@/lib/actions/booking";
import { demoAvailableSlots, demoShop } from "./fixtures/demo-shop";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  rpc: vi.fn(),
  rateLimit: vi.fn(),
  clientIp: vi.fn(),
  headers: vi.fn(),
  getLocale: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: mocks.rateLimit,
  clientIp: mocks.clientIp,
}));
vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));
vi.mock("next-intl/server", () => ({
  getLocale: mocks.getLocale,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

const appointmentId = "9a7cae8c-4959-4572-9789-9bc437b2bcec";
const startsAt = "2026-11-03T08:00:00+00:00";
const idempotencyKey = "bfeec20e-5e85-4da5-8c96-5cb1ca5d8e49";

function availabilityForm() {
  const formData = new FormData();
  formData.set("shopId", demoShop.id);
  formData.set("barberId", demoShop.barbers[0].id);
  formData.set("serviceId", demoShop.services[0].id);
  formData.set("date", "2026-11-03");
  return formData;
}

function bookingForm() {
  const formData = availabilityForm();
  formData.set("startsAt", startsAt);
  formData.set("idempotencyKey", idempotencyKey);
  return formData;
}

describe("customer booking actions with isolated demo data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.clientIp.mockReturnValue("127.0.0.1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getLocale.mockResolvedValue("en");
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "c04f07d4-ff7c-43f3-9166-74e1579d6cb2" } },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: demoAvailableSlots.map((slot_start) => ({ slot_start })), error: null });
    mocks.createClient.mockResolvedValue({
      auth: { getUser: mocks.getUser },
      rpc: mocks.rpc,
    });
  });

  it("returns validated sample availability from the database RPC contract", async () => {
    const result = await getAvailableSlots({}, availabilityForm());

    expect(result).toEqual({
      slots: demoAvailableSlots,
      requested: {
        serviceId: demoShop.services[0].id,
        barberId: demoShop.barbers[0].id,
        date: "2026-11-03",
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("get_available_slots", {
      p_shop_id: demoShop.id,
      p_barber_id: demoShop.barbers[0].id,
      p_service_id: demoShop.services[0].id,
      p_date: "2026-11-03",
    });
  });

  it("requires a signed-in customer before asking the booking RPC to reserve", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const result = await bookAppointment({}, bookingForm());

    expect(result).toEqual({ error: "login_required" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("submits a validated booking with idempotency and returns its reference", async () => {
    mocks.rpc.mockResolvedValue({ data: appointmentId, error: null });

    const result = await bookAppointment({}, bookingForm());

    expect(result).toEqual({
      success: "booked",
      appointmentId,
      bookedStartsAt: startsAt,
    });
    expect(mocks.rpc).toHaveBeenCalledWith("book_appointment", {
      p_shop_id: demoShop.id,
      p_barber_id: demoShop.barbers[0].id,
      p_service_id: demoShop.services[0].id,
      p_starts_at: startsAt,
      p_idempotency_key: idempotencyKey,
    });
  });

  it("reports a slot race without returning a success-shaped response", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "slot is no longer available" },
    });

    const result = await bookAppointment({}, bookingForm());

    expect(result).toEqual({ error: "slot_unavailable" });
  });

  it("cancels the current customer's appointment through the protected RPC", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const formData = new FormData();
    formData.set("appointmentId", appointmentId);

    const result = await cancelCustomerAppointment({}, formData);

    expect(result).toEqual({ success: "cancelled" });
    expect(mocks.rpc).toHaveBeenCalledWith("cancel_appointment", {
      p_appointment_id: appointmentId,
      p_reason: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/account/appointments");
  });

  it("reports appointments that the cancellation RPC will not cancel", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    const formData = new FormData();
    formData.set("appointmentId", appointmentId);

    const result = await cancelCustomerAppointment({}, formData);

    expect(result).toEqual({ error: "slot_unavailable" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
