import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";
import { getUser } from "@/lib/auth/session";

// Reads the session for CTA personalization; opt out of instant navigation
// (Cache Components migration can reintroduce a Suspense shell later).
export const instant = false;

export default async function LandingPage() {
  const t = await getTranslations();
  const user = await getUser();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-64px)] max-w-4xl flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-accent">
          QASSA · قصّة
        </p>
        <h1 className="font-display text-4xl font-bold sm:text-6xl">
          {t("landing.heroTitle")}
        </h1>
        <p className="mx-auto max-w-xl text-lg text-muted-foreground">
          {t("landing.heroSubtitle")}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4">
        <Link href="/discover" className={buttonClasses("primary", "lg")}>
          {t("landing.ctaDiscover")}
        </Link>
        {user ? (
          <Link href="/studio" className={buttonClasses("outline", "lg")}>
            {t("nav.studio")}
          </Link>
        ) : (
          <Link href="/login" className={buttonClasses("outline", "lg")}>
            {t("nav.login")}
          </Link>
        )}
      </div>
    </main>
  );
}
