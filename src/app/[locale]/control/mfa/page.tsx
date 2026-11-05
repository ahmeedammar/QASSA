import { getTranslations } from "next-intl/server";
import { ControlMfaSetup } from "@/components/control/mfa-setup";
import { requireControlMfaPage } from "@/lib/auth/control-page";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ControlMfaPage() {
  const [t, access] = await Promise.all([
    getTranslations("control"),
    requireControlMfaPage(),
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) console.error("Failed to list Control MFA factors", error);
  const factorId = data?.totp.find((factor) => factor.status === "verified")?.id
    ?? data?.all.find((factor) => factor.factor_type === "totp" && factor.status === "unverified")?.id
    ?? null;

  return (
    <main className="mx-auto grid max-w-xl gap-6 px-6 py-16">
      <header className="grid gap-3">
        <h1 className="font-display text-3xl font-bold">{t("mfaTitle")}</h1>
        <p className="text-muted-foreground">{t("mfaDescription")}</p>
      </header>
      <ControlMfaSetup factorId={factorId} />
    </main>
  );
}
