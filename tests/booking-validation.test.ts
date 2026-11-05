import { describe, expect, it } from "vitest";
import {
  availableSlotsResultSchema,
  availableSlotsSchema,
  bookAppointmentSchema,
  cancelCustomerAppointmentSchema,
} from "@/lib/validation/booking";

const shopId = "e80e3eed-21fb-4516-961a-28d9bb48937d";
const barberId = "f1b1b8c6-c7d6-468c-87d7-9712c4f4da25";
const serviceId = "80b23afd-37b4-40a2-944e-f0768de2ef6a";
const appointmentId = "8f00f33a-7ac4-4833-a961-c7b58d316fee";
const idempotencyKey = "bfeec20e-5e85-4da5-8c96-5cb1ca5d8e49";

describe("customer booking validation", () => {
  it("accepts valid availability requests and rejects invalid calendar dates", () => {
    expect(
      availableSlotsSchema.safeParse({
        shopId,
        barberId,
        serviceId,
        date: "2026-11-12",
      }).success,
    ).toBe(true);
    expect(
      availableSlotsSchema.safeParse({
        shopId,
        barberId,
        serviceId,
        date: "2026-11-31",
      }).success,
    ).toBe(false);
    expect(
      availableSlotsSchema.safeParse({
        shopId,
        barberId: "invalid",
        serviceId,
        date: "2026-11-12",
      }).success,
    ).toBe(false);
  });

  it("validates booking IDs, offsets, and Tunisia-local date consistency", () => {
    const request = {
      shopId,
      barberId,
      serviceId,
      date: "2026-11-12",
      startsAt: "2026-11-12T10:00:00+01:00",
      idempotencyKey,
    };
    expect(bookAppointmentSchema.safeParse(request).success).toBe(true);
    expect(
      bookAppointmentSchema.safeParse({
        ...request,
        date: "2026-11-13",
      }).success,
    ).toBe(false);
    expect(
      bookAppointmentSchema.safeParse({
        ...request,
        idempotencyKey: "not-a-uuid",
      }).success,
    ).toBe(false);
    expect(
      bookAppointmentSchema.safeParse({
        ...request,
        startsAt: "not-a-time",
      }).success,
    ).toBe(false);
  });

  it("validates slot RPC output and customer cancellation IDs", () => {
    expect(
      availableSlotsResultSchema.safeParse([
        { slot_start: "2026-11-12T09:00:00+00:00" },
      ]).success,
    ).toBe(true);
    expect(
      availableSlotsResultSchema.safeParse([{ slot_start: "invalid" }]).success,
    ).toBe(false);
    expect(
      cancelCustomerAppointmentSchema.safeParse({ appointmentId }).success,
    ).toBe(true);
    expect(
      cancelCustomerAppointmentSchema.safeParse({ appointmentId: "invalid" })
        .success,
    ).toBe(false);
  });
});
