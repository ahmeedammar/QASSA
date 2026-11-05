import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/auth/login-form";
import { FormMessage } from "@/components/auth/form-messages";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string; reset?: string; next?: string }>;
}) {
  const t = await getTranslations("auth");
  const params = await searchParams;
  const notice = params.registered ? "registered" : params.reset ? "reset" : undefined;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("loginTitle")}</h1>
      <FormMessage success={notice} />
      <LoginForm returnTo={params.next} />
    </div>
  );
}
