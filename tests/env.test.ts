import { describe, expect, it } from "vitest";
import { validateEnv } from "@/lib/env";

describe("Production environment validation (Milestone 8)", () => {
  const validBase = {
    NODE_ENV: "production",
    NEXT_PUBLIC_SUPABASE_URL: "https://example-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-with-sufficient-length",
    NEXT_PUBLIC_SITE_URL: "https://qassa.tn",
    UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
    UPSTASH_REDIS_REST_TOKEN: "redis-auth-token",
  };

  it("passes validation with complete production environment configuration", () => {
    const result = validateEnv(validBase);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.warnings).toHaveLength(0);
  });

  it("fails validation when NEXT_PUBLIC_SUPABASE_URL is missing or invalid", () => {
    const result = validateEnv({
      ...validBase,
      NEXT_PUBLIC_SUPABASE_URL: "not-a-valid-url",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
  });

  it("fails validation when NEXT_PUBLIC_SUPABASE_ANON_KEY is empty", () => {
    const result = validateEnv({
      ...validBase,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
  });

  it("warns in production when Upstash Redis credentials are absent", () => {
    const result = validateEnv({
      ...validBase,
      UPSTASH_REDIS_REST_URL: undefined,
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("UPSTASH_REDIS_*"))).toBe(true);
  });

  it("warns in production when SITE_URL points to localhost", () => {
    const result = validateEnv({
      ...validBase,
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
    });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("localhost in a production"))).toBe(true);
  });
});
