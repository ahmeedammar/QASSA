import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest } from "next/server";
import { updateSupabaseSession } from "@/lib/supabase/middleware";
import { routing } from "@/i18n/routing";
import { generateNonce, buildCspHeader } from "@/lib/csp";

const intlMiddleware = createIntlMiddleware(routing);

// Next.js 16 convention: middleware.ts is now proxy.ts. Session refresh,
// locale negotiation, and per-request CSP nonce injection happen here.
export default async function proxy(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce);

  const response = intlMiddleware(request);
  const sessionResponse = await updateSupabaseSession(request, response);

  sessionResponse.headers.set("Content-Security-Policy", csp);
  sessionResponse.headers.set("x-nonce", nonce);

  return sessionResponse;
}

export const config = {
  // Skip static files, images, API routes, and the locale-free auth callback:
  // next-intl would rewrite /auth/callback to /fr/auth/callback and the PKCE
  // code exchange would never run.
  matcher: ["/((?!api|_next|_vercel|auth|.*\\..*).*)"],
};
