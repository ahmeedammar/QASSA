import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  setShopSuspension,
  enrollControlMfa,
  verifyControlMfa,
} from "@/lib/actions/control";
import { demoShop } from "./fixtures/demo-shop";

const mocks = vi.hoisted(() => {
  class AdminAuthError extends Error {
    constructor(
      public readonly status: 401 | 403 | 428,
      message: string,
    ) {
      super(message);
    }
  }

  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "admin-row-id" }, error: null });
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  const fromSpy = vi.fn().mockReturnValue(fromChain);

  return {
    AdminAuthError,
    requireRecentAuth: vi.fn(),
    createClient: vi.fn(),
    getUser: vi.fn(),
    rpc: vi.fn(),
    rateLimit: vi.fn(),
    logAudit: vi.fn(),
    getLocale: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    fromSpy,
    fromChain,
    maybeSingle,
    mfaEnroll: vi.fn(),
    mfaChallengeAndVerify: vi.fn(),
  };
});

vi.mock("@/lib/auth/admin", () => ({
  AdminAuthError: mocks.AdminAuthError,
  requireRecentAuth: mocks.requireRecentAuth,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/audit", () => ({
  logAudit: mocks.logAudit,
}));
vi.mock("next-intl/server", () => ({
  getLocale: mocks.getLocale,
}));
vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

// ---------------------------------------------------------------------------
// Form helpers
// ---------------------------------------------------------------------------

function suspensionForm(overrides: Record<string, string | boolean> = {}) {
  const fd = new FormData();
  fd.set("shopId", typeof overrides.shopId === "string" ? overrides.shopId : demoShop.id);
  fd.set("shopSlug", typeof overrides.shopSlug === "string" ? overrides.shopSlug : demoShop.slug);
  fd.set("suspend", overrides.suspend !== undefined ? String(overrides.suspend) : "true");
  fd.set("reason", typeof overrides.reason === "string" ? overrides.reason : "Policy violation");
  return fd;
}

function mfaVerifyForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("factorId", overrides.factorId ?? "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
  fd.set("code", overrides.code ?? "123456");
  return fd;
}

// ---------------------------------------------------------------------------
// Happy-path setup
// ---------------------------------------------------------------------------

function setupHappyPath() {
  mocks.getLocale.mockResolvedValue("en");
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.requireRecentAuth.mockResolvedValue({
    userId: "11111111-1111-4111-8111-111111111111",
    adminId: "22222222-2222-4222-8222-222222222222",
    role: "operations_admin",
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.logAudit.mockResolvedValue(undefined);

  // getUser for requireActiveAdmin
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "11111111-1111-4111-8111-111111111111" } },
    error: null,
  });
  // platform_admins query returns a matching active record
  mocks.maybeSingle.mockResolvedValue({ data: { id: "admin-row-id" }, error: null });
  mocks.fromChain.select.mockReturnThis();
  mocks.fromChain.eq.mockReturnThis();
  mocks.fromSpy.mockReturnValue(mocks.fromChain);

  mocks.createClient.mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
      mfa: {
        enroll: mocks.mfaEnroll,
        challengeAndVerify: mocks.mfaChallengeAndVerify,
      },
    },
    from: mocks.fromSpy,
    rpc: mocks.rpc,
  });
}

// ---------------------------------------------------------------------------

describe("A. Admin privilege boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("setShopSuspension() returns forbidden when requireRecentAuth throws AdminAuthError(403, ...)", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(403, "Insufficient privileges."),
    );

    const result = await setShopSuspension({}, suspensionForm());
    expect(result).toEqual({ error: "forbidden" });
  });

  it("setShopSuspension() returns mfa_required when requireRecentAuth throws AdminAuthError(428, 'MFA verification required.')", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(428, "MFA verification required."),
    );

    const result = await setShopSuspension({}, suspensionForm());
    expect(result).toEqual({ error: "mfa_required" });
  });

  it("setShopSuspension() returns recent_auth_required when requireRecentAuth throws AdminAuthError(428, 'Recent authentication required.')", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(428, "Recent authentication required."),
    );

    const result = await setShopSuspension({}, suspensionForm());
    expect(result).toEqual({ error: "recent_auth_required" });
  });

  it("does NOT call the RPC when requireRecentAuth throws 403", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(403, "Insufficient privileges."),
    );

    await setShopSuspension({}, suspensionForm());
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does NOT call the RPC when requireRecentAuth throws 428 MFA", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(428, "MFA verification required."),
    );

    await setShopSuspension({}, suspensionForm());
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does NOT call the RPC when requireRecentAuth throws 428 recent auth", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(428, "Recent authentication required."),
    );

    await setShopSuspension({}, suspensionForm());
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enrollControlMfa() returns forbidden when the user has no active platform_admins record", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await enrollControlMfa({}, new FormData());
    expect(result).toEqual({ error: "forbidden" });
  });

  it("verifyControlMfa() returns forbidden when user has no active admin record (even with valid input)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await verifyControlMfa({}, mfaVerifyForm());
    expect(result).toEqual({ error: "forbidden" });
  });
});

describe("B. Input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("setShopSuspension() returns invalid_input when shopId is not a UUID", async () => {
    const result = await setShopSuspension({}, suspensionForm({ shopId: "not-a-uuid" }));
    expect(result).toEqual({ error: "invalid_input" });
    expect(mocks.requireRecentAuth).not.toHaveBeenCalled();
  });

  it("setShopSuspension() returns invalid_input when shopId is missing", async () => {
    const fd = new FormData();
    // shopId intentionally omitted
    fd.set("shopSlug", demoShop.slug);
    fd.set("suspend", "true");
    fd.set("reason", "test");

    const result = await setShopSuspension({}, fd);
    expect(result).toEqual({ error: "invalid_input" });
    expect(mocks.requireRecentAuth).not.toHaveBeenCalled();
  });

  it("verifyControlMfa() returns invalid_input when TOTP code is not 6 digits", async () => {
    const result = await verifyControlMfa({}, mfaVerifyForm({ code: "abc" }));
    expect(result).toEqual({ error: "invalid_input" });
  });
});

describe("C. Rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("setShopSuspension() returns too_many_requests when rateLimit returns { success: false } (after requireRecentAuth passes)", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });

    const result = await setShopSuspension({}, suspensionForm());
    expect(result).toEqual({ error: "too_many_requests" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("enrollControlMfa() returns too_many_requests when rateLimit returns { success: false }", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });

    const result = await enrollControlMfa({}, new FormData());
    expect(result).toEqual({ error: "too_many_requests" });
  });
});

describe("D. Audit trail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("setShopSuspension() calls logAudit with action 'shops.suspend' on success", async () => {
    const result = await setShopSuspension({}, suspensionForm({ suspend: true }));

    expect(result).toEqual({ success: "saved" });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "shops.suspend" }),
    );
  });

  it("setShopSuspension() calls logAudit with action 'shops.restore' when suspend is false", async () => {
    const result = await setShopSuspension({}, suspensionForm({ suspend: false }));

    expect(result).toEqual({ success: "saved" });
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "shops.restore" }),
    );
  });

  it("setShopSuspension() does NOT call logAudit when the RPC fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "RPC error" },
    });

    await setShopSuspension({}, suspensionForm());
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });
});
