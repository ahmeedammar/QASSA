"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

export type AuthFormState = {
  error?: string;
  success?: string;
};

function safeLocalizedReturnPath(value: FormDataEntryValue | null, locale: string) {
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    !value.startsWith(`/${locale}/`) ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return `/${locale}/studio`;
  }

  try {
    const url = new URL(value, "https://qassa.invalid");
    if (
      url.origin !== "https://qassa.invalid" ||
      !url.pathname.startsWith(`/${locale}/`)
    ) {
      return `/${locale}/studio`;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return `/${locale}/studio`;
  }
}

async function tooManyRequests(): Promise<AuthFormState> {
  return { error: "too_many_requests" };
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const ip = clientIp(await headers());
  const limit = await rateLimit(`login:${ip}:${parsed.data.email}`, "auth");
  if (!limit.success) return tooManyRequests();

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  // Generic message — never reveal whether the account exists.
  if (error) return { error: "invalid_credentials" };

  const locale = await getLocale();
  redirect(safeLocalizedReturnPath(formData.get("next"), locale));
}

export async function register(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const ip = clientIp(await headers());
  const limit = await rateLimit(`register:${ip}`, "auth");
  if (!limit.success) return tooManyRequests();

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        full_name: parsed.data.fullName,
        locale: await getLocale(),
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  // Generic success message either way (no account enumeration).
  if (error && error.status !== 429) {
    return { error: "registration_failed" };
  }

  const locale = await getLocale();
  const next = safeLocalizedReturnPath(formData.get("next"), locale);
  redirect(`/${locale}/login?registered=1&next=${encodeURIComponent(next)}`);
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const ip = clientIp(await headers());
  const limit = await rateLimit(`reset:${ip}:${parsed.data.email}`, "auth");
  if (!limit.success) return tooManyRequests();

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL;
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/auth/callback?next=reset-password` },
  );

  if (error && error.status !== 429) {
    return { error: "reset_failed" };
  }

  return { success: "reset_sent" };
}

export async function resetPassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { error: "reset_failed" };

  const locale = await getLocale();
  redirect(`/${locale}/login?reset=1`);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const locale = await getLocale();
  redirect(`/${locale}`);
}
