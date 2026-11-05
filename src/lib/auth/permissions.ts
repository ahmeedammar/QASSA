/**
 * Platform administrator permission model.
 *
 * Permissions are resolved HERE, server-side, from the admin's database role.
 * The `permissions` column on platform_admins is reserved for future
 * role-level overrides and is never read from client input.
 */

export const ADMIN_ROLES = [
  "platform_owner",
  "super_admin",
  "support_admin",
  "finance_admin",
  "operations_admin",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "platform.read_metrics",
  "platform.manage_settings",
  "platform.manage_admins",
  "shops.read",
  "shops.manage",
  "shops.suspend",
  "users.read",
  "users.manage",
  "subscriptions.read",
  "subscriptions.manage",
  "payments.verify",
  "payments.read",
  "support.manage",
  "marketplace.manage",
  "audit.read",
  "data.export",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ALL: AdminPermission[] = [...ADMIN_PERMISSIONS];

const READ_BASE: AdminPermission[] = ["platform.read_metrics", "shops.read"];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  platform_owner: ALL,
  // Super admin: everything except granting the platform_owner role itself
  // (enforced separately in the admin-management action) and changing
  // platform security settings.
  super_admin: ALL.filter(
    (p) => p !== "platform.manage_settings",
  ),
  support_admin: [
    ...READ_BASE,
    "users.read",
    "support.manage",
  ],
  finance_admin: [
    ...READ_BASE,
    "users.read",
    "subscriptions.read",
    "subscriptions.manage",
    "payments.read",
    "payments.verify",
  ],
  operations_admin: [
    ...READ_BASE,
    "users.read",
    "shops.manage",
    "shops.suspend",
    "marketplace.manage",
  ],
};

export function roleHasPermission(
  role: AdminRole,
  permission: AdminPermission,
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** Actions that require recent re-authentication (step-up), in minutes. */
export const SENSITIVE_ACTIONS: Partial<Record<AdminPermission, number>> = {
  "platform.manage_admins": 10,
  "platform.manage_settings": 10,
  "shops.suspend": 10,
  "subscriptions.manage": 15,
  "payments.verify": 15,
};
