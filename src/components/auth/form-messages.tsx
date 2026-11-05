"use client";

import { useTranslations } from "next-intl";

const MESSAGE_KEYS: Record<string, string> = {
  invalid_credentials: "loginError",
  invalid_input: "passwordPolicy",
  registration_failed: "error",
  reset_failed: "error",
  too_many_requests: "error",
  error: "error",
  reset_sent: "forgotSuccess",
  registered: "registerSuccess",
};

export function FormMessage({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const t = useTranslations("auth");
  const common = useTranslations("common");

  if (success) {
    return (
      <p className="rounded-lg bg-success/15 px-3 py-2 text-sm text-success">
        {t(MESSAGE_KEYS[success] ?? "resetSuccess")}
      </p>
    );
  }
  if (error) {
    return (
      <p className="rounded-lg bg-danger/15 px-3 py-2 text-sm text-danger">
        {MESSAGE_KEYS[error] ? t(MESSAGE_KEYS[error]) : common("error")}
      </p>
    );
  }
  return null;
}
