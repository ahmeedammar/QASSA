import { describe, expect, it } from "vitest";
import {
  saveBarberScheduleSchema,
  saveBarberBreakSchema,
  saveBarberDayOffSchema,
  saveShopBarberSchema,
  saveShopRestDaySchema,
  saveShopServiceSchema,
  updateStudioAppointmentSchema,
  saveBusinessHoursSchema,
  setBarberServicesSchema,
  setShopContentActiveSchema,
} from "@/lib/validation/studio";

const shopId = "e80e3eed-21fb-4516-961a-28d9bb48937d";
const barberId = "f1b1b8c6-c7d6-468c-87d7-9712c4f4da25";
const serviceId = "80b23afd-37b4-40a2-944e-f0768de2ef6a";

describe("Studio content validation", () => {
  it("accepts valid service details and normalizes optional descriptions", () => {
    const parsed = saveShopServiceSchema.safeParse({
      shopId,
      name: "  Fade cut ",
      description: "  ",
      durationMinutes: "30",
      bufferMinutes: "5",
      priceTnd: "12.500",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Fade cut");
      expect(parsed.data.description).toBeNull();
      expect(parsed.data.priceTnd).toBe(12.5);
    }
  });

  it("rejects invalid service duration, price precision, and IDs", () => {
    expect(
      saveShopServiceSchema.safeParse({
        shopId,
        name: "Cut",
        description: "",
        durationMinutes: "4",
        bufferMinutes: "0",
        priceTnd: "12",
      }).success,
    ).toBe(false);
    expect(
      saveShopServiceSchema.safeParse({
        shopId,
        name: "Cut",
        description: "",
        durationMinutes: "30",
        bufferMinutes: "0",
        priceTnd: "12.1234",
      }).success,
    ).toBe(false);
    expect(
      saveShopServiceSchema.safeParse({
        shopId: "not-a-uuid",
        name: "Cut",
        description: "",
        durationMinutes: "30",
        bufferMinutes: "0",
        priceTnd: "12",
      }).success,
    ).toBe(false);
  });

  it("validates barber profiles and assignment lists", () => {
    expect(
      saveShopBarberSchema.safeParse({
        shopId,
        displayName: "  Sami ",
        bio: "  ",
      }).success,
    ).toBe(true);
    expect(
      setBarberServicesSchema.safeParse({
        shopId,
        barberId,
        serviceIds: [serviceId],
      }).success,
    ).toBe(true);
    expect(
      setBarberServicesSchema.safeParse({
        shopId,
        barberId,
        serviceIds: ["not-a-uuid"],
      }).success,
    ).toBe(false);
  });

  it("requires explicit values for activation actions", () => {
    const valid = setShopContentActiveSchema.safeParse({
      shopId,
      recordId: serviceId,
      active: "false",
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.active).toBe(false);

    expect(
      setShopContentActiveSchema.safeParse({
        shopId,
        recordId: serviceId,
        active: "invalid",
      }).success,
    ).toBe(false);
  });

  it("only accepts valid weekly opening and barber work periods", () => {
    expect(
      saveBusinessHoursSchema.safeParse({
        shopId,
        weekday: "1",
        opensAt: "09:00",
        closesAt: "18:00",
      }).success,
    ).toBe(true);
    expect(
      saveBusinessHoursSchema.safeParse({
        shopId,
        weekday: "1",
        opensAt: "18:00",
        closesAt: "09:00",
      }).success,
    ).toBe(false);
    expect(
      saveBarberScheduleSchema.safeParse({
        shopId,
        barberId,
        weekday: "6",
        startsAt: "08:30",
        endsAt: "13:00",
      }).success,
    ).toBe(true);
    expect(
      saveBarberScheduleSchema.safeParse({
        shopId,
        barberId,
        weekday: "6",
        startsAt: "25:00",
        endsAt: "13:00",
      }).success,
    ).toBe(false);
    expect(
      saveBusinessHoursSchema.safeParse({
        shopId,
        opensAt: "09:00",
        closesAt: "18:00",
      }).success,
    ).toBe(false);
  });

  it("validates recurring breaks and date-based availability exceptions", () => {
    expect(
      saveBarberBreakSchema.safeParse({
        shopId,
        barberId,
        weekday: "2",
        startsAt: "12:00",
        endsAt: "13:00",
      }).success,
    ).toBe(true);
    expect(
      saveBarberBreakSchema.safeParse({
        shopId,
        barberId,
        weekday: "2",
        startsAt: "13:00",
        endsAt: "12:00",
      }).success,
    ).toBe(false);

    expect(
      saveBarberDayOffSchema.safeParse({
        shopId,
        barberId,
        startsOn: "2026-02-28",
        endsOn: "2026-03-01",
        reason: "  Vacation ",
      }).success,
    ).toBe(true);
    expect(
      saveBarberDayOffSchema.safeParse({
        shopId,
        barberId,
        startsOn: "2026-02-30",
        endsOn: "2026-03-01",
        reason: "",
      }).success,
    ).toBe(false);
    expect(
      saveBarberDayOffSchema.safeParse({
        shopId,
        barberId,
        startsOn: "2026-03-02",
        endsOn: "2026-03-01",
        reason: "",
      }).success,
    ).toBe(false);
  });

  it("requires the weekly rest day to be a real weekday", () => {
    for (const weekday of ["0", "1", "6"]) {
      expect(saveShopRestDaySchema.safeParse({ shopId, weekday }).success).toBe(true);
    }
    for (const weekday of ["7", "-1", "", "1.5", "Monday"]) {
      expect(saveShopRestDaySchema.safeParse({ shopId, weekday }).success).toBe(false);
    }
    expect(saveShopRestDaySchema.safeParse({ shopId }).success).toBe(false);
  });

  it("only allows supported Studio appointment outcomes", () => {
    expect(
      updateStudioAppointmentSchema.safeParse({
        shopId,
        appointmentId: serviceId,
        status: "completed",
        reason: "",
      }).success,
    ).toBe(true);
    expect(
      updateStudioAppointmentSchema.safeParse({
        shopId,
        appointmentId: serviceId,
        status: "confirmed",
        reason: "",
      }).success,
    ).toBe(false);
    expect(
      updateStudioAppointmentSchema.safeParse({
        shopId,
        appointmentId: serviceId,
        status: "cancelled",
        reason: "x".repeat(251),
      }).success,
    ).toBe(false);
  });
});
