"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { login, type AuthFormState } from "@/lib/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { FormMessage } from "./form-messages";

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    login,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {returnTo && <input type="hidden" name="next" value={returnTo} />}
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
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className={inputClasses()}
        />
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "w-full")}>
        {pending ? "…" : t("loginSubmit")}
      </button>
      <div className="flex flex-col gap-2 text-center text-sm">
        <Link href="/forgot-password" className="text-primary hover:underline">
          {t("forgotLink")}
        </Link>
        <Link href="/register" className="text-primary hover:underline">
          {t("registerLink")}
        </Link>
      </div>
    </form>
  );
}
