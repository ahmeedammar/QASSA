import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  saveShopService,
  saveShopBarber,
  saveBusinessHours,
  setShopPublished,
  updateStudioAppointment,
  saveBarberSchedule,
  saveShopHoliday,
  saveShopWebsite,
} from "@/lib/actions/studio";
import { demoShop } from "./fixtures/demo-shop";

// IDs for the "other" shop used in cross-tenant tests.
const SHOP_B_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const mocks = vi.hoisted(() => {
  // The chained query builder used by authorizeShopManager and
  // subsequent data-layer calls.
  const maybeSingle = vi.fn().mockResolvedValue({
    data: { role: "owner" },
    error: null,
  });
  const fromChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle,
  };
  const fromSpy = vi.fn().mockReturnValue(fromChain);

  return {
    createClient: vi.fn(),
    getUser: vi.fn(),
    rpc: vi.fn(),
    rateLimit: vi.fn(),
    getLocale: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn(),
    fromSpy,
    fromChain,
    maybeSingle,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));
vi.mock("@/lib/ratelimit", () => ({
  rateLimit: mocks.rateLimit,
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

function serviceForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("name", overrides.name ?? "Haircut");
  fd.set("description", overrides.description ?? "");
  fd.set("durationMinutes", overrides.durationMinutes ?? "30");
  fd.set("bufferMinutes", overrides.bufferMinutes ?? "10");
  fd.set("priceTnd", overrides.priceTnd ?? "25");
  return fd;
}

function barberForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("displayName", overrides.displayName ?? "Sami");
  fd.set("bio", overrides.bio ?? "");
  return fd;
}

function businessHoursForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("weekday", overrides.weekday ?? "1");
  fd.set("opensAt", overrides.opensAt ?? "09:00");
  fd.set("closesAt", overrides.closesAt ?? "18:00");
  return fd;
}

function publishForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("publish", overrides.publish ?? "true");
  return fd;
}

function appointmentForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("appointmentId", overrides.appointmentId ?? "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
  fd.set("status", overrides.status ?? "cancelled");
  fd.set("reason", overrides.reason ?? "");
  return fd;
}

function barberScheduleForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("barberId", overrides.barberId ?? demoShop.barbers[0].id);
  fd.set("weekday", overrides.weekday ?? "1");
  fd.set("startsAt", overrides.startsAt ?? "09:00");
  fd.set("endsAt", overrides.endsAt ?? "18:00");
  return fd;
}

function holidayForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("holidayDate", overrides.holidayDate ?? "2027-01-01");
  fd.set("reason", overrides.reason ?? "New Year");
  return fd;
}

function websiteForm(overrides: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("shopId", overrides.shopId ?? demoShop.id);
  fd.set("name", overrides.name ?? demoShop.name);
  fd.set("slug", overrides.slug ?? demoShop.slug);
  fd.set("city", overrides.city ?? "Tunis");
  fd.set("address", overrides.address ?? "1 Rue Principale");
  fd.set("phone", overrides.phone ?? "+216 71 000 000");
  fd.set("description", overrides.description ?? "");
  fd.set("templateId", overrides.templateId ?? "classic_gentleman");
  return fd;
}

// ---------------------------------------------------------------------------
// Default happy-path setup
// ---------------------------------------------------------------------------

function setupHappyPath() {
  mocks.getLocale.mockResolvedValue("en");
  mocks.rateLimit.mockResolvedValue({ success: true });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
  // authorizeShopManager: owner membership
  mocks.maybeSingle.mockResolvedValue({ data: { role: "owner" }, error: null });
  // rpc and data-layer calls succeed by default
  mocks.rpc.mockResolvedValue({ data: { published: true, missing: [] }, error: null });
  mocks.fromChain.select.mockReturnThis();
  mocks.fromChain.eq.mockReturnThis();
  mocks.fromChain.update.mockReturnThis();
  mocks.fromChain.insert.mockReturnThis();
  mocks.fromChain.delete.mockReturnThis();
  mocks.fromSpy.mockReturnValue(mocks.fromChain);
  mocks.createClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.fromSpy,
    rpc: mocks.rpc,
  });
}

// ---------------------------------------------------------------------------

describe("A. Tenant isolation / IDOR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("saveShopService() returns forbidden when user is a member of shop B but submits shop A's shopId", async () => {
    // The user belongs to SHOP_B only — no matching row for shop_a + user_id
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await saveShopService({}, serviceForm({ shopId: demoShop.id }));
    expect(result).toEqual({ error: "forbidden" });
  });

  it("saveShopBarber() returns forbidden when authorizeShopManager returns no matching membership", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await saveShopBarber({}, barberForm());
    expect(result).toEqual({ error: "forbidden" });
  });

  it("saveBusinessHours() returns forbidden when the user has role 'barber' (not owner/manager)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { role: "barber" }, error: null });

    const result = await saveBusinessHours({}, businessHoursForm());
    expect(result).toEqual({ error: "forbidden" });
  });

  it("setShopPublished() returns forbidden when membership check finds no row for this user+shop", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await setShopPublished({}, publishForm());
    expect(result).toEqual({ error: "forbidden" });
  });

  it("updateStudioAppointment() returns forbidden when membership check fails", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await updateStudioAppointment({}, appointmentForm());
    expect(result).toEqual({ error: "forbidden" });
  });
});

describe("B. Rate limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("saveShopService() returns too_many_requests when rate-limited (after auth passes)", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });

    const result = await saveShopService({}, serviceForm());
    expect(result).toEqual({ error: "too_many_requests" });
  });

  it("saveBarberSchedule() returns too_many_requests when rate-limited", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });

    const result = await saveBarberSchedule({}, barberScheduleForm());
    expect(result).toEqual({ error: "too_many_requests" });
  });
});

describe("C. Input validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it("saveShopService() returns invalid_input when shopId is not a valid UUID", async () => {
    const result = await saveShopService({}, serviceForm({ shopId: "not-a-uuid" }));
    expect(result).toEqual({ error: "invalid_input" });
    // Should never reach the auth check.
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("saveShopHoliday() returns already_exists when Supabase returns error code 23505", async () => {
    // The insert resolves with a unique-violation error.
    mocks.maybeSingle.mockResolvedValueOnce(
      // first call: authorizeShopManager → owner
      { data: { role: "owner" }, error: null },
    ).mockResolvedValueOnce(
      // second call: the actual insert result
      { data: null, error: { code: "23505", message: "duplicate key" } },
    );

    const result = await saveShopHoliday({}, holidayForm());
    expect(result).toEqual({ error: "already_exists" });
  });

  it("saveShopWebsite() returns slug_taken when RPC returns error code 23505", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate slug" },
    });

    const result = await saveShopWebsite({}, websiteForm());
    expect(result).toEqual({ error: "slug_taken" });
  });

  it("updateStudioAppointment() returns not_available when RPC returns false (not true)", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const result = await updateStudioAppointment({}, appointmentForm());
    expect(result).toEqual({ error: "not_available" });
  });
});

describe("D. Unauthenticated access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
    // redirect throws in Next.js to abort the render.
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("saveShopBarber() calls redirect when getUser returns null (no session)", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    await expect(saveShopBarber({}, barberForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalled();
  });
});
