import { useTranslations } from "next-intl";
import { ResetForm } from "@/components/auth/reset-form";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("resetTitle")}</h1>
      <ResetForm />
    </div>
  );
}
