import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

describe("Health check endpoint (/api/health) — Milestone 8", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.limit.mockResolvedValue({ data: [{ id: "test" }], error: null });
    mocks.select.mockReturnValue({ limit: mocks.limit });
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.createClient.mockResolvedValue({ from: mocks.from });
  });

  it("returns status 200 with healthy state when database is reachable", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.database.latencyMs).toBeTypeOf("number");
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("returns status 503 with unhealthy state when database returns error", async () => {
    mocks.limit.mockResolvedValue({
      data: null,
      error: { message: "connection refused" },
    });

    const res = await GET();
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.status).toBe("unhealthy");
    expect(body.checks.database.status).toBe("error");
    expect(body.checks.database.message).toBe("connection refused");
  });
});
