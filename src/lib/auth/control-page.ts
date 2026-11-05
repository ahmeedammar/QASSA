import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  roleHasPermission,
  type AdminPermission,
  type AdminRole,
} from "./permissions";
import type { AdminContext } from "./admin";

export type ControlPageAccess =
  | { status: "ok"; ctx: AdminContext }
  | { status: "forbidden" };

/**
 * Soft gate for Control pages. Mutations still call requireAdmin() /
 * requireRecentAuth() independently. Denied visits are not audited here so
 * unknown URLs do not fill the administrative trail.
 */
export async function requireControlPageAccess(
  permission: AdminPermission,
): Promise<ControlPageAccess> {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/control`)}`,
    );
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin || !roleHasPermission(admin.role as AdminRole, permission)) {
    return { status: "forbidden" };
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || aal.currentLevel !== "aal2") {
    redirect(`/${locale}/control/mfa`);
  }

  return {
    status: "ok",
    ctx: {
      userId: user.id,
      adminId: admin.id,
      role: admin.role as AdminRole,
    },
  };
}

export async function requireControlMfaPage(): Promise<ControlPageAccess> {
  const locale = await getLocale();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/control`)}`,
    );
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError || !admin) {
    return { status: "forbidden" };
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    redirect(`/${locale}/control`);
  }

  return {
    status: "ok",
    ctx: {
      userId: user.id,
      adminId: admin.id,
      role: admin.role as AdminRole,
    },
  };
}
