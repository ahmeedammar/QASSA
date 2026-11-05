import { beforeEach, describe, expect, it, vi } from "vitest";
import { login, register, requestPasswordReset } from "@/lib/actions/auth";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  rateLimit: vi.fn(),
  clientIp: vi.fn(),
  headers: vi.fn(),
  getLocale: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: mocks.rateLimit,
  clientIp: mocks.clientIp,
}));
vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));
vi.mock("next-intl/server", () => ({
  getLocale: mocks.getLocale,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

function loginForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("email", overrides.email ?? "user@example.com");
  formData.set("password", overrides.password ?? "ValidPass1");
  if (overrides.next !== undefined) formData.set("next", overrides.next);
  return formData;
}

function registerForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("fullName", overrides.fullName ?? "Test User");
  formData.set("email", overrides.email ?? "new@example.com");
  formData.set("password", overrides.password ?? "ValidPass1");
  if (overrides.next !== undefined) formData.set("next", overrides.next);
  return formData;
}

function resetForm(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("email", overrides.email ?? "user@example.com");
  return formData;
}

describe("A. safeLocalizedReturnPath — open-redirect prevention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.clientIp.mockReturnValue("127.0.0.1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getLocale.mockResolvedValue("en");
    mocks.signInWithPassword.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: mocks.signInWithPassword },
    });
    // redirect throws in Next.js; simulate that so the action doesn't
    // continue after a redirect call.
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("redirects to /${locale}/studio when `next` is an external URL", async () => {
    await expect(
      login({}, loginForm({ next: "https://evil.com/steal" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/en/studio");
  });

  it("redirects to /${locale}/studio when `next` starts with //", async () => {
    await expect(
      login({}, loginForm({ next: "//evil.com/steal" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/en/studio");
  });

  it("redirects to /${locale}/studio when `next` contains a backslash", async () => {
    await expect(
      login({}, loginForm({ next: "/en/studio\\@evil.com" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/en/studio");
  });

  it("redirects to /${locale}/studio when `next` is too long (2001 chars)", async () => {
    await expect(
      login({}, loginForm({ next: "/en/" + "a".repeat(1997) })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/en/studio");
  });

  it("redirects to /${locale}/studio when `next` is a valid path for a different locale", async () => {
    await expect(
      login({}, loginForm({ next: "/fr/studio" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/en/studio");
  });

  it("follows a valid same-locale path", async () => {
    await expect(
      login({}, loginForm({ next: "/en/account/appointments" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/en/account/appointments");
  });
});

describe("B. Rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.clientIp.mockReturnValue("10.0.0.1");
    mocks.rateLimit.mockResolvedValue({ success: false });
    mocks.getLocale.mockResolvedValue("en");
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signUp: mocks.signUp,
        resetPasswordForEmail: mocks.resetPasswordForEmail,
      },
    });
  });

  it("login() returns too_many_requests when rateLimit returns { success: false }", async () => {
    const result = await login({}, loginForm());
    expect(result).toEqual({ error: "too_many_requests" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("register() returns too_many_requests when rateLimit returns { success: false }", async () => {
    const result = await register({}, registerForm());
    expect(result).toEqual({ error: "too_many_requests" });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("requestPasswordReset() returns too_many_requests when rateLimit returns { success: false }", async () => {
    const result = await requestPasswordReset({}, resetForm());
    expect(result).toEqual({ error: "too_many_requests" });
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

describe("C. Account enumeration protection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.clientIp.mockReturnValue("127.0.0.1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getLocale.mockResolvedValue("en");
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("login() returns invalid_credentials — never 'account not found' — when signInWithPassword errors", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      error: { status: 400, message: "Invalid login credentials" },
    });
    mocks.createClient.mockResolvedValue({
      auth: { signInWithPassword: mocks.signInWithPassword },
    });

    const result = await login({}, loginForm());
    expect(result).toEqual({ error: "invalid_credentials" });
  });

  it("register() redirects (not errors) even if signUp succeeds silently for a duplicate email", async () => {
    // Supabase returns no error for duplicate e-mails (email enumeration
    // protection is handled server-side — it sends a confirmation email to
    // the existing address without revealing it's a duplicate).
    mocks.signUp.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { signUp: mocks.signUp },
    });

    await expect(register({}, registerForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalled();
    // The redirect target must be the login page, not an error page.
    const target: string = mocks.redirect.mock.calls[0][0];
    expect(target).toMatch(/\/en\/login/);
  });

  it("requestPasswordReset() returns { success: 'reset_sent' } even when the email doesn't exist", async () => {
    // Supabase does not expose whether the address exists; it always
    // returns no error (or a 429-only error on rate-limit).
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({
      auth: { resetPasswordForEmail: mocks.resetPasswordForEmail },
    });

    const result = await requestPasswordReset({}, resetForm({ email: "ghost@example.com" }));
    expect(result).toEqual({ success: "reset_sent" });
  });
});

describe("D. Input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.clientIp.mockReturnValue("127.0.0.1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getLocale.mockResolvedValue("en");
    mocks.createClient.mockResolvedValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
        signUp: mocks.signUp,
      },
    });
  });

  it("login() returns invalid_input for an empty email", async () => {
    const result = await login({}, loginForm({ email: "" }));
    expect(result).toEqual({ error: "invalid_input" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("login() returns invalid_input for a password longer than 72 chars", async () => {
    const result = await login({}, loginForm({ password: "A1" + "x".repeat(71) }));
    expect(result).toEqual({ error: "invalid_input" });
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });

  it("register() returns invalid_input for a password shorter than 8 chars", async () => {
    const result = await register({}, registerForm({ password: "Ab1" }));
    expect(result).toEqual({ error: "invalid_input" });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("register() returns invalid_input for a password with no digit", async () => {
    const result = await register({}, registerForm({ password: "NoDigitsHere" }));
    expect(result).toEqual({ error: "invalid_input" });
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
});
