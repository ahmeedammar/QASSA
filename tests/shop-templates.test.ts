import { describe, expect, it } from "vitest";
import {
  isShopTemplateId,
  SHOP_TEMPLATES,
  type ShopTemplateId,
} from "@/lib/shops/templates";
import { shopTemplateSchema, updateShopWebsiteSchema } from "@/lib/validation/shops";

const expectedTemplates: ShopTemplateId[] = [
  "royal_gold",
  "urban_cut",
  "classic_gentleman",
  "minimal_studio",
  "dark_prestige",
];

describe("shop website templates", () => {
  it("provides complete render styles for all five supported templates", () => {
    expect(Object.keys(SHOP_TEMPLATES).sort()).toEqual(
      [...expectedTemplates].sort(),
    );
    for (const id of expectedTemplates) {
      const template = SHOP_TEMPLATES[id];
      expect(template.label).toBeTruthy();
      expect(template.shell).toBeTruthy();
      expect(template.accent).toBeTruthy();
      expect(template.panel).toBeTruthy();
      expect(template.preview).toBeTruthy();
      expect(shopTemplateSchema.safeParse(id).success).toBe(true);
      expect(isShopTemplateId(id)).toBe(true);
    }
    expect(isShopTemplateId("unknown")).toBe(false);
  });

  it("accepts every template when saving a shop website", () => {
    for (const templateId of expectedTemplates) {
      expect(
        updateShopWebsiteSchema.safeParse({
          shopId: "e80e3eed-21fb-4516-961a-28d9bb48937d",
          name: "Barber House",
          slug: "barber-house",
          city: "Tunis",
          address: "",
          phone: "",
          description: "",
          templateId,
        }).success,
      ).toBe(true);
    }
  });
});
