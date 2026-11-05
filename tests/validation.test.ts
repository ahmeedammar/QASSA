import { describe, expect, it } from "vitest";
import {
  loginSchema,
  passwordSchema,
  registerSchema,
} from "@/lib/validation/auth";

describe("auth validation", () => {
  it("accepts a valid password", () => {
    expect(passwordSchema.safeParse("Passw0rd").success).toBe(true);
  });

  it("rejects short, letter-only or number-only passwords", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
    expect(passwordSchema.safeParse("onlyletters").success).toBe(false);
    expect(passwordSchema.safeParse("12345678").success).toBe(false);
  });

  it("normalizes email to lowercase and trims", () => {
    const parsed = loginSchema.safeParse({
      email: "  Founder@Example.COM ",
      password: "whatever1",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("founder@example.com");
  });

  it("rejects malformed emails", () => {
    expect(
      registerSchema.safeParse({
        fullName: "Test",
        email: "not-an-email",
        password: "Passw0rd",
      }).success,
    ).toBe(false);
  });

  it("preserves Arabic names intact", () => {
    const parsed = registerSchema.safeParse({
      fullName: "أحمد بن علي",
      email: "ahmed@example.com",
      password: "Passw0rd",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.fullName).toBe("أحمد بن علي");
  });
});
