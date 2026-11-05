"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import {
  enrollControlMfa,
  verifyControlMfa,
  type ControlActionState,
} from "@/lib/actions/control";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";

function MfaFeedback({ state }: { state: ControlActionState }) {
  const t = useTranslations("control");
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
        {t(`errors.${state.error}`)}
      </p>
    );
  }
  return null;
}

export function ControlMfaSetup({
  factorId,
}: {
  factorId: string | null;
}) {
  const t = useTranslations("control");
  const [enrollState, enrollAction, enrollPending] = useActionState<
    ControlActionState,
    FormData
  >(enrollControlMfa, {});
  const [verifyState, verifyAction, verifyPending] = useActionState<
    ControlActionState,
    FormData
  >(verifyControlMfa, {});

  const activeFactorId = enrollState.factorId ?? factorId;
  const secret = enrollState.secret;
  const uri = enrollState.uri;

  return (
    <div className="grid gap-6">
      <form action={enrollAction} className="grid gap-3">
        <p className="text-sm text-muted-foreground">{t("mfaEnrollHelp")}</p>
        <button
          type="submit"
          disabled={enrollPending}
          className={buttonClasses("outline", "md")}
        >
          {enrollPending ? t("saving") : t("enrollMfa")}
        </button>
        <MfaFeedback state={enrollState} />
        {secret && (
          <p className="rounded-lg bg-surface px-3 py-2 text-sm">
            {t("mfaSecret")}: <code className="break-all">{secret}</code>
          </p>
        )}
        {uri && (
          <p className="text-sm break-all text-muted-foreground">{uri}</p>
        )}
      </form>

      {activeFactorId && (
        <form action={verifyAction} className="grid gap-3">
          <input type="hidden" name="factorId" value={activeFactorId} />
          <label className="grid gap-1 text-sm font-medium">
            {t("mfaCode")}
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              className={inputClasses()}
            />
          </label>
          <button
            type="submit"
            disabled={verifyPending}
            className={buttonClasses("primary", "md")}
          >
            {verifyPending ? t("saving") : t("verifyMfa")}
          </button>
          <MfaFeedback state={verifyState} />
        </form>
      )}
    </div>
  );
}
