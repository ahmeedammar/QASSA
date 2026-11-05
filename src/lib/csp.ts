/**
 * Content Security Policy (CSP) with cryptographic nonces for Next.js App Router.
 *
 * Each HTML request generates a cryptographically random nonce. In modern browsers,
 * 'strict-dynamic' causes the browser to trust inline scripts carrying this nonce
 * and scripts dynamically loaded by them, while ignoring unsafe-inline.
 */

export function generateNonce(): string {
  // Cryptographically secure 128-bit random base64 string
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return Buffer.from(crypto.randomUUID()).toString("base64");
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  }
  return Buffer.from(bytes).toString("base64");
}

export function buildCspHeader(nonce: string, isProduction = process.env.NODE_ENV === "production"): string {
  const scriptSrc = isProduction
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' https: 'unsafe-inline'`
    : `'self' 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`;

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://*.supabase.co",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join("; ");
}
