"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { buttonClasses } from "@/components/ui/button";

function hintKey(code: string): string {
  if (code === "PGRST202" || code === "42883") return "missingFunction";
  if (code === "unexpected_shape") return "schema";
  if (code.startsWith("PGRST3")) return "session";
  return "generic";
}

/**
 * A dead-end "try again" told the operator nothing. The retry re-runs the
 * server component, and the folded detail carries the Postgres/PostgREST code
 * so a schema drift can be recognised without reaching the runtime logs.
 */
export function ControlLoadError({
  code,
  detail,
}: {
  code: string;
  detail: string;
}) {
  const t = useTranslations("control");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <section
      role="alert"
      className="qassa-slide-in grid gap-4 rounded-2xl border border-danger/30 bg-danger/10 p-6"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-danger/15 text-danger"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 8v5" strokeLinecap="round" />
            <circle cx="12" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
            <path d="M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="grid gap-1">
          <h2 className="font-semibold text-danger">{t("loadError")}</h2>
          <p className="text-sm leading-7 text-muted-foreground">
            {t(`loadErrorHint.${hintKey(code)}`)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
          className={buttonClasses("primary", "sm", "qassa-cta")}
        >
          {pending ? t("retrying") : t("retry")}
        </button>
        <Link href="/login" className={buttonClasses("outline", "sm")}>
          {t("relogin")}
        </Link>
      </div>

      <details className="rounded-xl border border-border bg-background/60 px-4 py-3">
        <summary className="cursor-pointer text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {t("diagnostics")}
        </summary>
        <dl className="mt-3 grid gap-2 text-xs">
          <div className="flex gap-2">
            <dt className="font-semibold text-muted-foreground">{t("diagnosticCode")}</dt>
            <dd className="font-mono">{code}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="font-semibold text-muted-foreground">{t("diagnosticDetail")}</dt>
            <dd className="font-mono break-words">{detail}</dd>
          </div>
        </dl>
      </details>
    </section>
  );
}