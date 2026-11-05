import { z } from "zod";

export const shopTemplateSchema = z.enum([
  "royal_gold",
  "urban_cut",
  "classic_gentleman",
  "minimal_studio",
  "dark_prestige",
]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null);

export const createShopSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  city: optionalText(120),
  address: optionalText(240),
  phone: optionalText(40),
  description: optionalText(2000),
  templateId: shopTemplateSchema,
});

export const updateShopWebsiteSchema = z.object({
  shopId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
  city: optionalText(120),
  address: optionalText(240),
  phone: optionalText(40),
  description: optionalText(2000),
  templateId: shopTemplateSchema,
});

export type CreateShopInput = z.infer<typeof createShopSchema>;
