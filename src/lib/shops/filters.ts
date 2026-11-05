import { z } from "zod";

const filterSchema = z.string().trim().max(80);
const pageSchema = z
  .string()
  .regex(/^[1-9]\d{0,3}$/)
  .transform(Number)
  .pipe(z.number().max(1000));

export function parseMarketplaceFilter(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined) return { value: "", valid: true };

  const result = filterSchema.safeParse(candidate);
  return result.success
    ? { value: result.data, valid: true }
    : { value: "", valid: false };
}

export function parseMarketplacePage(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === undefined) return { value: 1, valid: true };

  const result = pageSchema.safeParse(candidate);
  return result.success
    ? { value: result.data, valid: true }
    : { value: 1, valid: false };
}
