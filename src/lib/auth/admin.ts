import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  roleHasPermission,
  SENSITIVE_ACTIONS,
  type AdminPermission,
  type AdminRole,
} from "./permissions";

export class AdminAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 428,
    message: string,
  ) {
    super(message);
  }
}

export interface AdminContext {
  userId: string;
  adminId: string;
  role: AdminRole;
}

/**
 * Authorize a platform administrative operation.
 *
 * Independently verifies, for EVERY call:
 *  1. Valid authenticated session
 *  2. Session not expired/revoked (getUser validates against Supabase)
 *  3. Active platform_admins record
 *  4. Role permits the requested permission
 *  5. (Scope checks belong to the calling action — pass resource context there)
 *  6. MFA: AAL2 required for all QASSA Control operations
 *
 * This must be called inside server actions / route handlers that touch
 * protected data. Never rely on layouts, middleware or URL checks alone.
 */
export async function requireAdmin(
  permission: AdminPermission,
): Promise<AdminContext> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new AdminAuthError(401, "Authentication required.");
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) {
    // Record the failed attempt; do not disclose anything else.
    const { error: auditError } = await supabase.rpc("log_audit_event", {
      p_action: "admin.access_denied",
      p_resource_type: "platform_admins",
      p_success: false,
    });
    if (auditError) {
      console.error("Failed to record denied administrative access", auditError);
      throw new Error("Unable to record administrative access denial.");
    }
    throw new AdminAuthError(403, "Insufficient privileges.");
  }

  if (!roleHasPermission(admin.role as AdminRole, permission)) {
    throw new AdminAuthError(403, "Insufficient privileges.");
  }

  // MFA enforcement: all Control operations require AAL2.
  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal.currentLevel !== "aal2") {
    throw new AdminAuthError(428, "MFA verification required.");
  }

  // Best-effort activity timestamp via the security-definer RPC
  // (direct updates to platform_admins are blocked by RLS by design).
  void supabase.rpc("touch_admin_last_used");

  return {
    userId: user.id,
    adminId: admin.id,
    role: admin.role as AdminRole,
  };
}

/**
 * Step-up check for sensitive operations. Supabase does not expose a
 * re-authentication timestamp, so we proxy with last_sign_in_at: sensitive
 * actions must occur within the action's window after the last fresh sign-in.
 */
export async function requireRecentAuth(permission: AdminPermission): Promise<AdminContext> {
  const ctx = await requireAdmin(permission);
  const windowMinutes = SENSITIVE_ACTIONS[permission];
  if (!windowMinutes) return ctx;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
  const fresh =
    lastSignIn &&
    Date.now() - lastSignIn.getTime() <= windowMinutes * 60 * 1000;

  if (!fresh) {
    throw new AdminAuthError(428, "Recent authentication required.");
  }
  return ctx;
}

/** Helper for pages: soft check that redirects instead of throwing. */
export async function getAdminContext(): Promise<AdminContext | null> {
  try {
    return await requireAdmin("platform.read_metrics");
  } catch {
    return null;
  }
}

export { redirect };
