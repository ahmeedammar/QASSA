export const SHOP_TEMPLATES = {
  royal_gold: {
    label: "royalGold",
    shell: "bg-[#171918] text-[#f2eee5]",
    accent: "text-[#b89b70]",
    panel: "border-[#b89b70]/40 bg-[#1f2220]",
    preview: "bg-[#171918] text-[#b89b70]",
  },
  urban_cut: {
    label: "urbanCut",
    shell: "bg-[#176b68] text-[#f2eee5]",
    accent: "text-white",
    panel: "border-white/30 bg-black/10",
    preview: "bg-[#176b68] text-white",
  },
  classic_gentleman: {
    label: "classicGentleman",
    shell: "bg-[#f2eee5] text-[#171918]",
    accent: "text-[#176b68]",
    panel: "border-[#dcd5c4] bg-[#faf8f2]",
    preview: "bg-[#f2eee5] text-[#176b68]",
  },
  minimal_studio: {
    label: "minimalStudio",
    shell: "bg-white text-[#171918]",
    accent: "text-[#176b68]",
    panel: "border-[#dcd5c4] bg-[#faf8f2]",
    preview: "bg-white text-[#176b68]",
  },
  dark_prestige: {
    label: "darkPrestige",
    shell: "bg-[#111312] text-[#f2eee5]",
    accent: "text-[#c5b99f]",
    panel: "border-[#333835] bg-[#1f2220]",
    preview: "bg-[#111312] text-[#c5b99f]",
  },
} as const;

export type ShopTemplateId = keyof typeof SHOP_TEMPLATES;

export function isShopTemplateId(value: string): value is ShopTemplateId {
  return Object.hasOwn(SHOP_TEMPLATES, value);
}
