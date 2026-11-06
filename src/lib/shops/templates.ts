export const SHOP_TEMPLATES = {
  royal_gold: {
    label: "royalGold",
    shell: "bg-[#171918] text-[#f2eee5]",
    accent: "text-[#b89b70]",
    panel: "border-[#b89b70]/40 bg-[#1f2220]",
    preview: "bg-[#171918] text-[#b89b70]",
    cta: "bg-[#b89b70] text-[#171918] hover:bg-[#c9ab7f]",
    ghost: "border-[#b89b70]/60 text-[#f2eee5] hover:bg-[#b89b70]/15",
    chip: "bg-black/35 text-[#f2eee5] ring-1 ring-white/20",
    scrim: "from-black/85 via-black/45 to-black/15",
    muted: "text-[#c5b99f]",
  },
  urban_cut: {
    label: "urbanCut",
    shell: "bg-[#176b68] text-[#f2eee5]",
    accent: "text-white",
    panel: "border-white/30 bg-black/10",
    preview: "bg-[#176b68] text-white",
    cta: "bg-white text-[#176b68] hover:bg-[#f2eee5]",
    ghost: "border-white/60 text-white hover:bg-white/15",
    chip: "bg-black/30 text-white ring-1 ring-white/25",
    scrim: "from-[#07201f]/90 via-[#07201f]/45 to-transparent",
    muted: "text-white/80",
  },
  classic_gentleman: {
    label: "classicGentleman",
    shell: "bg-[#f2eee5] text-[#171918]",
    accent: "text-[#176b68]",
    panel: "border-[#dcd5c4] bg-[#faf8f2]",
    preview: "bg-[#f2eee5] text-[#176b68]",
    cta: "bg-[#176b68] text-[#f2eee5] hover:bg-[#1d7f7b]",
    ghost: "border-[#176b68]/45 text-[#176b68] hover:bg-[#176b68]/10",
    chip: "bg-white/80 text-[#171918] ring-1 ring-[#dcd5c4]",
    scrim: "from-[#0f1211]/85 via-[#0f1211]/45 to-transparent",
    muted: "text-[#5b615c]",
  },
  minimal_studio: {
    label: "minimalStudio",
    shell: "bg-white text-[#171918]",
    accent: "text-[#176b68]",
    panel: "border-[#dcd5c4] bg-[#faf8f2]",
    preview: "bg-white text-[#176b68]",
    cta: "bg-[#171918] text-white hover:bg-[#2a2e2b]",
    ghost: "border-[#171918]/30 text-[#171918] hover:bg-[#171918]/8",
    chip: "bg-white/85 text-[#171918] ring-1 ring-black/10",
    scrim: "from-black/80 via-black/40 to-transparent",
    muted: "text-[#5b615c]",
  },
  dark_prestige: {
    label: "darkPrestige",
    shell: "bg-[#111312] text-[#f2eee5]",
    accent: "text-[#c5b99f]",
    panel: "border-[#333835] bg-[#1f2220]",
    preview: "bg-[#111312] text-[#c5b99f]",
    cta: "bg-[#c5b99f] text-[#111312] hover:bg-[#d5cbb5]",
    ghost: "border-[#c5b99f]/50 text-[#f2eee5] hover:bg-[#c5b99f]/15",
    chip: "bg-white/10 text-[#f2eee5] ring-1 ring-white/20",
    scrim: "from-black/90 via-black/50 to-transparent",
    muted: "text-[#a9aea8]",
  },
} as const;

export type ShopTemplateId = keyof typeof SHOP_TEMPLATES;

export type ShopTemplate = (typeof SHOP_TEMPLATES)[ShopTemplateId];

export function isShopTemplateId(value: string): value is ShopTemplateId {
  return Object.hasOwn(SHOP_TEMPLATES, value);
}
