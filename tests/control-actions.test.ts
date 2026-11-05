import { beforeEach, describe, expect, it, vi } from "vitest";
import { setShopSuspension } from "@/lib/actions/control";
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
  return {
    AdminAuthError,
    requireRecentAuth: vi.fn(),
    createClient: vi.fn(),
    rpc: vi.fn(),
    rateLimit: vi.fn(),
    logAudit: vi.fn(),
    getLocale: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
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

function suspensionForm(suspend = true) {
  const formData = new FormData();
  formData.set("shopId", demoShop.id);
  formData.set("shopSlug", demoShop.slug);
  formData.set("suspend", suspend ? "true" : "false");
  formData.set("reason", "Policy violation");
  return formData;
}

describe("Control shop suspension actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getLocale.mockResolvedValue("en");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.requireRecentAuth.mockResolvedValue({
      userId: "11111111-1111-4111-8111-111111111111",
      adminId: "22222222-2222-4222-8222-222222222222",
      role: "operations_admin",
    });
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
    mocks.logAudit.mockResolvedValue(undefined);
  });

  it("suspends through the protected RPC and records an audit event", async () => {
    const result = await setShopSuspension({}, suspensionForm());

    expect(result).toEqual({ success: "saved" });
    expect(mocks.rpc).toHaveBeenCalledWith("set_shop_suspension", {
      p_shop_id: demoShop.id,
      p_is_suspended: true,
      p_reason: "Policy violation",
    });
    expect(mocks.logAudit).toHaveBeenCalledWith({
      action: "shops.suspend",
      resourceType: "barbershops",
      resourceId: demoShop.id,
      metadata: { slug: demoShop.slug },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/control");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/en/discover");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/en/shop/${demoShop.slug}`,
    );
  });

  it("does not call the RPC when the administrator lacks shops.suspend", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(403, "Insufficient privileges."),
    );

    const result = await setShopSuspension({}, suspensionForm());

    expect(result).toEqual({ error: "forbidden" });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.logAudit).not.toHaveBeenCalled();
  });

  it("asks for a fresh sign-in instead of suspending after the step-up window", async () => {
    mocks.requireRecentAuth.mockRejectedValue(
      new mocks.AdminAuthError(428, "Recent authentication required."),
    );

    const result = await setShopSuspension({}, suspensionForm());

    expect(result).toEqual({ error: "recent_auth_required" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
