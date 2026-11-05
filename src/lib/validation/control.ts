import { z } from "zod";

const shopIdSchema = z.string().uuid();
const optionalReason = z
  .string()
  .trim()
  .max(250)
  .transform((value) => value || null);

export const setShopSuspensionSchema = z.object({
  shopId: shopIdSchema,
  shopSlug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  suspend: z.enum(["true", "false"]).transform((value) => value === "true"),
  reason: optionalReason.optional(),
});

export const verifyControlMfaSchema = z.object({
  factorId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});
