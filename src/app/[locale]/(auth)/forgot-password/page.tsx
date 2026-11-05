import { useTranslations } from "next-intl";
import { ForgotForm } from "@/components/auth/forgot-form";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("forgotTitle")}</h1>
      <ForgotForm />
    </div>
  );
}
