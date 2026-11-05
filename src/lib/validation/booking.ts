import { z } from "zod";

const uuidSchema = z.string().uuid();
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  });

export const availableSlotsSchema = z.object({
  shopId: uuidSchema,
  barberId: uuidSchema,
  serviceId: uuidSchema,
  date: dateSchema,
});

export const bookAppointmentSchema = availableSlotsSchema
  .extend({
    startsAt: z.string().datetime({ offset: true }),
    idempotencyKey: uuidSchema,
  })
  .refine(
    ({ startsAt, date }) => {
      const start = new Date(startsAt);
      if (Number.isNaN(start.valueOf())) return true;
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Africa/Tunis",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(start);
      const localDate = `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
      return localDate === date;
    },
    { path: ["startsAt"], message: "slot_date_mismatch" },
  );

export const cancelCustomerAppointmentSchema = z.object({
  appointmentId: uuidSchema,
});

export const availableSlotsResultSchema = z.array(
  z.object({ slot_start: z.string().datetime({ offset: true }) }),
);

export type AvailableSlotsInput = z.infer<typeof availableSlotsSchema>;
