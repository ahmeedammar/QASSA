"use client";

import { useTranslations } from "next-intl";
import type { StudioActionState } from "@/lib/actions/studio";

export function StudioActionFeedback({
  state,
}: {
  state: StudioActionState;
}) {
  const t = useTranslations("studio");

  if (state.missing?.length) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-foreground"
      >
        <p className="font-semibold">{t("publicationIncomplete")}</p>
        <ul className="mt-2 list-inside list-disc">
          {state.missing.map((requirement) => (
            <li key={requirement}>{t(`requirements.${requirement}`)}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
        {t(`managementErrors.${state.error}`)}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
        {t("managementSaved")}
      </p>
    );
  }
  return null;
}
