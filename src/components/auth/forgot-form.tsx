"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  requestPasswordReset,
  type AuthFormState,
} from "@/lib/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { FormMessage } from "./form-messages";

export function ForgotForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={inputClasses()}
        />
      </div>
      <FormMessage error={state.error} success={state.success} />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "w-full")}>
        {pending ? "…" : t("forgotSubmit")}
      </button>
      <div className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          {t("loginLink")}
        </Link>
      </div>
    </form>
  );
}
