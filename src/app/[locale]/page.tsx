import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { getUser } from "@/lib/auth/session";

// Reads the session for CTA personalization; opt out of instant navigation
// (Cache Components migration can reintroduce a Suspense shell later).
export const instant = false;

const CTA_BASE =
  "qassa-cta inline-flex h-13 items-center justify-center gap-2 rounded-xl px-7 text-base font-semibold tracking-wide";
const HERO_PRIMARY = `${CTA_BASE} bg-[#f2eee5] text-[#171918]`;
const HERO_GHOST =
  "inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-white/10 px-7 text-base font-medium text-white ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20";
const OWNER_CTA = `${CTA_BASE} bg-primary text-primary-foreground`;

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const tNav = await getTranslations("nav");
  const user = await getUser();

  return (
    <main>
      <section className="relative isolate overflow-hidden">
        <HeroBackdrop />

        <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-5xl flex-col items-center justify-center px-6 py-20 text-center sm:px-8">
          <p
            className="qassa-slide-in text-sm font-semibold tracking-[0.3em] text-[#b89b70] uppercase"
            style={{ animationDelay: "40ms" }}
          >
            QASSA · قصّة
          </p>

          <h1
            className="qassa-slide-in mt-5 max-w-3xl font-display text-4xl leading-[1.06] font-bold text-[#f7f3ea] drop-shadow-[0_6px_24px_rgba(0,0,0,0.45)] sm:text-6xl lg:text-7xl"
            style={{ animationDelay: "120ms" }}
          >
            {t("heroTitle")}
          </h1>

          <p
            className="qassa-slide-in mt-6 max-w-2xl text-base leading-8 text-white/85 sm:text-lg"
            style={{ animationDelay: "200ms" }}
          >
            {t("heroSubtitle")}
          </p>

          <div
            className="qassa-slide-in mt-9 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "280ms" }}
          >
            <Link href="/discover" className={HERO_PRIMARY}>
              {t("ctaDiscover")}
            </Link>
            {user ? (
              <Link href="/studio" className={HERO_GHOST}>
                {tNav("studio")}
              </Link>
            ) : (
              <Link href="/login" className={HERO_GHOST}>
                {tNav("login")}
              </Link>
            )}
          </div>

          <p
            className="qassa-slide-in mt-10 inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-sm"
            style={{ animationDelay: "360ms" }}
          >
            <span className="relative flex size-2">
              <span className="qassa-ping absolute inline-flex size-full rounded-full bg-[#c5b99f]" />
              <span className="relative inline-flex size-2 rounded-full bg-[#c5b99f]" />
            </span>
            {t("badge")}
          </p>
        </div>
      </section>

      <section className="border-t border-border bg-surface/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:py-20">
          <div>
            <p className="text-xs font-semibold tracking-[0.24em] text-accent uppercase">
              {t("ownerEyebrow")}
            </p>
            <h2 className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
              {t("ownerTitle")}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-8 text-muted-foreground">
              {t("ownerText")}
            </p>
            <Link
              href={user ? "/studio" : "/register"}
              className={`${OWNER_CTA} mt-8`}
            >
              {t("ctaOwner")}
            </Link>
          </div>

          <ul className="qassa-stagger grid gap-4">
            {[t("ownerPointSite"), t("ownerPointTeam"), t("ownerPointBookings")].map(
              (point) => (
                <li
                  key={point}
                  className="qassa-card flex items-start gap-4 rounded-2xl border border-border bg-background p-5"
                >
                  <span
                    aria-hidden="true"
                    className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"
                  >
                    <svg viewBox="0 0 24 24" className="qassa-check size-4" fill="none">
                      <path
                        d="M5 13l4 4L19 7"
                        pathLength="1"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  <span className="text-sm leading-7 font-medium">{point}</span>
                </li>
              ),
            )}
          </ul>
        </div>
      </section>
    </main>
  );
}