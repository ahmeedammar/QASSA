import { NextIntlClientProvider } from "next-intl";

// Auth routes read the session (server actions, cookie refresh) — opt out of
// instant navigation validation; streaming shell is unnecessary here.
export const instant = false;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </div>
    </main>
  );
}
