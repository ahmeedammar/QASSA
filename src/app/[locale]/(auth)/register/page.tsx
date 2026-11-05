import { getTranslations } from "next-intl/server";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [t, params] = await Promise.all([
    getTranslations("auth"),
    searchParams,
  ]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("registerTitle")}</h1>
      <RegisterForm returnTo={params.next} />
    </div>
  );
}
