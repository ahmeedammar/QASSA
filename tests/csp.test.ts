import { describe, expect, it } from "vitest";
import { generateNonce, buildCspHeader } from "@/lib/csp";

describe("CSP nonce generation and policy construction (Milestone 8)", () => {
  it("generates a valid, non-empty base64 nonce", () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).toBeDefined();
    expect(nonce1.length).toBeGreaterThanOrEqual(16);
    expect(nonce1).not.toEqual(nonce2); // Distinct nonces
  });

  it("includes the cryptographic nonce and strict-dynamic in production mode", () => {
    const nonce = "test-crypto-nonce-123";
    const csp = buildCspHeader(nonce, true);

    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("https://*.supabase.co");
  });

  it("includes unsafe-eval in development mode for HMR support", () => {
    const nonce = "dev-nonce-456";
    const csp = buildCspHeader(nonce, false);

    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(csp).toContain("'unsafe-eval'");
  });
});
