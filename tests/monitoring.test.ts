import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/monitoring";

describe("Production monitoring and structured logging (Milestone 8)", () => {
  it("sanitizes passwords, secrets, and auth tokens from log context", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    logger.error("Test error event", new Error("Simulated failure"), {
      userId: "user-123",
      password: "SuperSecretPassword123!",
      token: "secret-bearer-token",
      authorization: "Bearer 12345",
      shopId: "shop-abc",
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(consoleSpy.mock.calls[0][0]);

    expect(logged.level).toBe("error");
    expect(logged.message).toBe("Test error event");
    expect(logged.error.message).toBe("Simulated failure");
    expect(logged.context.userId).toBe("user-123");
    expect(logged.context.shopId).toBe("shop-abc");
    expect(logged.context.password).toBe("[REDACTED]");
    expect(logged.context.token).toBe("[REDACTED]");
    expect(logged.context.authorization).toBe("[REDACTED]");

    consoleSpy.mockRestore();
  });
});
