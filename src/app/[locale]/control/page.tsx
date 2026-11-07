import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { ControlDashboard } from "@/components/control/control-dashboard";
import { ControlLoadError } from "@/components/control/control-load-error";
import { requireControlPageAccess } from "@/lib/auth/control-page";
import { roleHasPermission } from "@/lib/auth/permissions";
import { loadControlShops } from "@/lib/control/shops";

export const instant = false;

export default async function ControlPage() {
  const [locale, t, access] = await Promise.all([
    getLocale(),
    getTranslations("control"),
    requireControlPageAccess("shops.read"),
  ]);

  if (access.status !== "ok") {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
        <p role="alert" className="mt-4 rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("forbidden")}
        </p>
      </main>
    );
  }

  const result = await loadControlShops();

  // The page gate and the RPC read the same identity, but a token refreshed
  // between the two calls can leave PostgREST without a sub. Re-authenticate
  // instead of showing the operator a retry button that can never succeed.
  if (result.status === "unauthenticated") {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/control`)}`,
    );
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:px-8">
      <header className="qassa-slide-in grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{t("title")}</h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ring-1 ring-primary/25">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {t(`roles.${access.ctx.role}`)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success ring-1 ring-success/25">
            {t("mfaActive")}
          </span>
        </div>
        <p className="max-w-3xl text-muted-foreground">{t("description")}</p>
      </header>

      {result.status === "forbidden" ? (
        <p role="alert" className="rounded-lg bg-danger/15 px-4 py-3 text-sm text-danger">
          {t("forbidden")}
        </p>
      ) : result.status === "failed" ? (
        <ControlLoadError code={result.code} detail={result.detail} />
      ) : (
        <ControlDashboard
          shops={result.shops}
          locale={locale}
          canSuspend={roleHasPermission(access.ctx.role, "shops.suspend")}
          truncated={result.truncated}
        />
      )}
    </main>
  );
}