import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import messagesAr from "../../../messages/ar.json";
import messagesFr from "../../../messages/fr.json";
import messagesEn from "../../../messages/en.json";

const MESSAGES = { ar: messagesAr, fr: messagesFr, en: messagesEn } as const;
import { routing, isRtl } from "@/i18n/routing";
import {
  fontDisplay,
  fontSecondary,
  fontUi,
  fontArabicDisplay,
  fontArabicBody,
} from "@/lib/fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "brand" });
  return {
    title: `QASSA — ${t("slogan")}`,
    description: t("slogan"),
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const t = await getTranslations("nav");
  const tCommon = await getTranslations("common");

  return (
    <html
      lang={locale}
      dir={isRtl(locale) ? "rtl" : "ltr"}
      suppressHydrationWarning
      className={[
        fontDisplay.variable,
        fontSecondary.variable,
        fontUi.variable,
        fontArabicDisplay.variable,
        fontArabicBody.variable,
      ].join(" ")}
    >
      <body className="min-h-screen antialiased">
        {/* Explicit locale + statically imported messages: avoids the
            uncached request-config read that breaks Cache Components prerendering. */}
        <NextIntlClientProvider
          locale={locale}
          messages={MESSAGES[locale as keyof typeof MESSAGES]}
        >
          <ThemeProvider>
            <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-8">
              <span className="font-display text-xl font-bold tracking-wide">
                {locale === "ar" ? "قصّة" : "QASSA"}
              </span>
              <div className="flex items-center gap-3">
                <LanguageSwitcher locale={locale as "ar" | "fr" | "en"} label={tCommon("language")} />
                <ThemeToggle ariaLabel={t("theme")} />
              </div>
            </header>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
