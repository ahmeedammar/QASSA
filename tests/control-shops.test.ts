import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadControlShops, PLATFORM_SHOP_PAGE_SIZE } from "@/lib/control/shops";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

beforeEach(() => {
  mocks.createClient.mockResolvedValue({ rpc: mocks.rpc });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const row = {
  id: "224ddbba-240a-466a-b0c2-9bd5b64ab715",
  name: "Zitouna Barber Club",
  slug: "zitouna-barber-club",
  city: "Tunis",
  is_published: true,
  is_suspended: false,
  suspension_reason: null,
  created_at: "2026-11-01T10:00:00.000Z",
};

describe("loadControlShops", () => {
  it("returns parsed shops and flags a list that reached the row cap", async () => {
    mocks.rpc.mockResolvedValue({ data: [row], error: null });
    const result = await loadControlShops();
    expect(result).toEqual({ status: "ok", shops: [row], truncated: false });

    mocks.rpc.mockResolvedValue({
      data: Array.from({ length: PLATFORM_SHOP_PAGE_SIZE }, (_, index) => ({
        ...row,
        id: `224ddbba-240a-466a-b0c2-${String(index).padStart(12, "0")}`,
      })),
      error: null,
    });
    const capped = await loadControlShops();
    expect(capped.status).toBe("ok");
    expect(capped.status === "ok" && capped.truncated).toBe(true);
  });

  it("separates a missing identity from a missing permission", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "28000", message: "Authentication required." },
    });
    expect(await loadControlShops()).toEqual({ status: "unauthenticated" });

    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "42501", message: "Platform administrator access required." },
    });
    expect(await loadControlShops()).toEqual({ status: "forbidden" });
  });

  it("surfaces the PostgREST code when the function is not deployed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.list_platform_shops",
      },
    });

    expect(await loadControlShops()).toEqual({
      status: "failed",
      code: "PGRST202",
      detail: "Could not find the function public.list_platform_shops",
    });
  });

  it("reports schema drift instead of rendering an empty list", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValue({ data: [{ ...row, is_published: "yes" }], error: null });

    const result = await loadControlShops();
    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.code).toBe("unexpected_shape");
    expect(result.status === "failed" && result.detail).toContain("is_published");
  });

  it("treats a null payload as an empty platform", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: null });
    expect(await loadControlShops()).toEqual({
      status: "ok",
      shops: [],
      truncated: false,
    });
  });
});