import {
  Montserrat,
  Plus_Jakarta_Sans,
  Inter,
  Tajawal,
  Cairo,
} from "next/font/google";

export const fontDisplay = Montserrat({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const fontSecondary = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-secondary",
  display: "swap",
});

export const fontUi = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const fontArabicDisplay = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-arabic-display",
  display: "swap",
});

export const fontArabicBody = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-arabic-body",
  display: "swap",
});
