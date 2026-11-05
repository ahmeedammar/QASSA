import { z } from "zod";

const shopIdSchema = z.string().uuid();
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

const integerField = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const durationSchema = integerField(5, 480);
const bufferSchema = integerField(0, 120);
const weekdaySchema = integerField(0, 6);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });
const priceSchema = z
  .string()
  .regex(/^\d{1,7}(?:\.\d{1,3})?$/)
  .transform(Number)
  .pipe(z.number().max(100000));

export const saveShopServiceSchema = z.object({
  shopId: shopIdSchema,
  serviceId: shopIdSchema.optional(),
  name: z.string().trim().min(1).max(120),
  description: optionalText(1000),
  durationMinutes: durationSchema,
  bufferMinutes: bufferSchema,
  priceTnd: priceSchema,
});

export const setShopContentActiveSchema = z.object({
  shopId: shopIdSchema,
  recordId: shopIdSchema,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const saveShopBarberSchema = z.object({
  shopId: shopIdSchema,
  barberId: shopIdSchema.optional(),
  displayName: z.string().trim().min(1).max(120),
  bio: optionalText(1000),
});

export const setBarberServicesSchema = z.object({
  shopId: shopIdSchema,
  barberId: shopIdSchema,
  serviceIds: z.array(shopIdSchema).max(100),
});

export const saveBusinessHoursSchema = z
  .object({
    shopId: shopIdSchema,
    hoursId: shopIdSchema.optional(),
    weekday: weekdaySchema,
    opensAt: timeSchema,
    closesAt: timeSchema,
  })
  .refine((value) => value.closesAt > value.opensAt, {
    path: ["closesAt"],
    message: "closes_after_open",
  });

export const saveBarberScheduleSchema = z
  .object({
    shopId: shopIdSchema,
    scheduleId: shopIdSchema.optional(),
    barberId: shopIdSchema,
    weekday: weekdaySchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "ends_after_start",
  });

export const saveBarberBreakSchema = z
  .object({
    shopId: shopIdSchema,
    breakId: shopIdSchema.optional(),
    barberId: shopIdSchema,
    weekday: weekdaySchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((value) => value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "ends_after_start",
  });

export const saveBarberDayOffSchema = z
  .object({
    shopId: shopIdSchema,
    dayOffId: shopIdSchema.optional(),
    barberId: shopIdSchema,
    startsOn: dateSchema,
    endsOn: dateSchema,
    reason: optionalText(250),
  })
  .refine((value) => value.endsOn >= value.startsOn, {
    path: ["endsOn"],
    message: "ends_after_start",
  });

export const saveShopHolidaySchema = z.object({
  shopId: shopIdSchema,
  holidayId: shopIdSchema.optional(),
  holidayDate: dateSchema,
  reason: optionalText(250),
});

export const deleteStudioScheduleSchema = z.object({
  shopId: shopIdSchema,
  recordId: shopIdSchema,
  kind: z.enum(["hours", "schedule"]),
});

export const deleteStudioExceptionSchema = z.object({
  shopId: shopIdSchema,
  recordId: shopIdSchema,
  kind: z.enum(["break", "day_off", "holiday"]),
});

export const updateStudioAppointmentSchema = z.object({
  shopId: shopIdSchema,
  appointmentId: shopIdSchema,
  status: z.enum(["cancelled", "completed", "no_show"]),
  reason: optionalText(250),
});
