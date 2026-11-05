import { describe, expect, it } from "vitest";
import {
  parseMarketplaceFilter,
  parseMarketplacePage,
} from "@/lib/shops/filters";

describe("marketplace query validation", () => {
  it("trims valid text filters and accepts absent filters", () => {
    expect(parseMarketplaceFilter("  Tunis  ")).toEqual({
      value: "Tunis",
      valid: true,
    });
    expect(parseMarketplaceFilter(undefined)).toEqual({
      value: "",
      valid: true,
    });
  });

  it("rejects oversized filters instead of silently querying", () => {
    expect(parseMarketplaceFilter("x".repeat(81))).toEqual({
      value: "",
      valid: false,
    });
  });

  it("accepts only positive, bounded page numbers", () => {
    expect(parseMarketplacePage("3")).toEqual({ value: 3, valid: true });
    expect(parseMarketplacePage("0").valid).toBe(false);
    expect(parseMarketplacePage("1001").valid).toBe(false);
    expect(parseMarketplacePage("1.5").valid).toBe(false);
  });
});
