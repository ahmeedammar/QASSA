import { describe, expect, it } from "vitest";
import {
  setShopSuspensionSchema,
  verifyControlMfaSchema,
} from "@/lib/validation/control";
import { demoShop } from "./fixtures/demo-shop";

describe("Control shop suspension validation", () => {
  it("accepts a restore request and treats a blank reason as null", () => {
    const parsed = setShopSuspensionSchema.safeParse({
      shopId: demoShop.id,
      shopSlug: demoShop.slug,
      suspend: "false",
      reason: "   ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.suspend).toBe(false);
      expect(parsed.data.reason).toBeNull();
    }
  });

  it("rejects invalid slugs, IDs, and over-long reasons", () => {
    expect(
      setShopSuspensionSchema.safeParse({
        shopId: "not-a-uuid",
        shopSlug: demoShop.slug,
        suspend: "true",
      }).success,
    ).toBe(false);
    expect(
      setShopSuspensionSchema.safeParse({
        shopId: demoShop.id,
        shopSlug: "Invalid Slug",
        suspend: "true",
      }).success,
    ).toBe(false);
    expect(
      setShopSuspensionSchema.safeParse({
        shopId: demoShop.id,
        shopSlug: demoShop.slug,
        suspend: "true",
        reason: "x".repeat(251),
      }).success,
    ).toBe(false);
  });

  it("accepts a 6-digit MFA code and rejects other shapes", () => {
    expect(
      verifyControlMfaSchema.safeParse({
        factorId: demoShop.id,
        code: "123456",
      }).success,
    ).toBe(true);
    expect(
      verifyControlMfaSchema.safeParse({
        factorId: demoShop.id,
        code: "12345",
      }).success,
    ).toBe(false);
  });
});
