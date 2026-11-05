import { describe, expect, it } from "vitest";
import { createShopSchema } from "@/lib/validation/shops";

const validShop = {
  name: "Barber House",
  slug: "barber-house",
  city: "Tunis",
  address: "Main Street",
  phone: "+216 12 345 678",
  description: "A local barbershop",
  templateId: "classic_gentleman",
};

describe("shop onboarding validation", () => {
  it("accepts valid details and trims optional fields", () => {
    const parsed = createShopSchema.safeParse({
      ...validShop,
      city: "  Tunis ",
      address: "   ",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.city).toBe("Tunis");
      expect(parsed.data.address).toBeNull();
    }
  });

  it("normalizes the slug but rejects invalid paths and templates", () => {
    expect(
      createShopSchema.safeParse({ ...validShop, slug: " Barber-House " })
        .success,
    ).toBe(true);
    expect(
      createShopSchema.safeParse({ ...validShop, slug: "-barber-house" })
        .success,
    ).toBe(false);
    expect(
      createShopSchema.safeParse({ ...validShop, templateId: "untrusted" })
        .success,
    ).toBe(false);
  });

  it("rejects oversized names and descriptions", () => {
    expect(
      createShopSchema.safeParse({ ...validShop, name: "x".repeat(121) })
        .success,
    ).toBe(false);
    expect(
      createShopSchema.safeParse({
        ...validShop,
        description: "x".repeat(2001),
      }).success,
    ).toBe(false);
  });
});
