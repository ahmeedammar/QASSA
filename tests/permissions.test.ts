import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  ADMIN_ROLES,
  ROLE_PERMISSIONS,
  roleHasPermission,
  SENSITIVE_ACTIONS,
} from "@/lib/auth/permissions";

describe("admin permission model", () => {
  it("every declared role has a permission set", () => {
    for (const role of ADMIN_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("platform owner can do everything", () => {
    for (const permission of ADMIN_PERMISSIONS) {
      expect(roleHasPermission("platform_owner", permission)).toBe(true);
    }
  });

  it("support admin cannot touch payments, subscriptions or admins", () => {
    for (const permission of [
      "payments.verify",
      "subscriptions.manage",
      "platform.manage_admins",
    ] as const) {
      expect(roleHasPermission("support_admin", permission)).toBe(false);
    }
  });

  it("finance admin cannot suspend shops or manage admins", () => {
    expect(roleHasPermission("finance_admin", "shops.suspend")).toBe(false);
    expect(roleHasPermission("finance_admin", "platform.manage_admins")).toBe(
      false,
    );
    expect(roleHasPermission("finance_admin", "payments.verify")).toBe(true);
  });

  it("operations admin cannot verify payments", () => {
    expect(roleHasPermission("operations_admin", "payments.verify")).toBe(
      false,
    );
    expect(roleHasPermission("operations_admin", "shops.suspend")).toBe(true);
  });

  it("sensitive actions all declare a reauth window", () => {
    for (const window of Object.values(SENSITIVE_ACTIONS)) {
      expect(window).toBeGreaterThan(0);
      expect(window).toBeLessThanOrEqual(30);
    }
  });
});
