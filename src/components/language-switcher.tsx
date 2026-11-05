"use client";

import { usePathname, useRouter } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";

const LABELS: Record<Locale, string> = { ar: "العربية", fr: "FR", en: "EN" };

// Locale arrives as a prop from the server layout — this component renders
// outside any NextIntlClientProvider (which reads uncached request data).
export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // Strip the current locale prefix and rebuild with the new one.
    const stripped = pathname.replace(/^\/(ar|fr|en)/, "") || "/";
    router.push(`/${next}${stripped}` as never);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-1" aria-label={label}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l as Locale)}
          aria-pressed={l === locale}
          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
            l === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {LABELS[l as Locale]}
        </button>
      ))}
    </div>
  );
}
