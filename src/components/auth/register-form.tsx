"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { register, type AuthFormState } from "@/lib/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/input";
import { FormMessage } from "./form-messages";

export function RegisterForm({ returnTo }: { returnTo?: string }) {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    register,
    {},
  );

  return (
    <form action={formAction} className="space-y-5">
      {returnTo && <input type="hidden" name="next" value={returnTo} />}
      <div className="space-y-2">
        <label htmlFor="fullName" className="text-sm font-medium">
          {t("fullName")}
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          className={inputClasses()}
        />
      </div>
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
          autoComplete="new-password"
          aria-describedby="password-policy"
          className={inputClasses()}
        />
        <p id="password-policy" className="text-xs text-muted-foreground">
          {t("passwordPolicy")}
        </p>
      </div>
      <FormMessage error={state.error} />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "w-full")}>
        {pending ? "…" : t("registerSubmit")}
      </button>
      <div className="text-center text-sm">
        <Link href="/login" className="text-primary hover:underline">
          {t("loginLink")}
        </Link>
      </div>
    </form>
  );
}
