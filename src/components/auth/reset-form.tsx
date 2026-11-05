"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetPassword, type AuthFormState } from "@/lib/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { FormMessage } from "./form-messages";

export function ResetForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    resetPassword,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          aria-describedby="password-policy"
          className={inputClasses()}
        />
        <p id="password-policy" className="text-xs text-muted-foreground">
          {t("passwordPolicy")}
        </p>
      </div>
      <FormMessage error={state.error} success={state.success} />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "w-full")}>
        {pending ? "…" : t("resetSubmit")}
      </button>
    </form>
  );
}
