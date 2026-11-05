"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { AdminAuthError, requireRecentAuth } from "@/lib/auth/admin";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/ratelimit";
import { createClient } from "@/lib/supabase/server";
import {
  setShopSuspensionSchema,
  verifyControlMfaSchema,
} from "@/lib/validation/control";

export type ControlActionState = {
  error?:
    | "invalid_input"
    | "too_many_requests"
    | "login_required"
    | "forbidden"
    | "mfa_required"
    | "recent_auth_required"
    | "not_available"
    | "failed";
  success?: "saved" | "enrolled" | "verified";
  factorId?: string;
  secret?: string;
  uri?: string;
};

function mapAdminError(error: unknown): ControlActionState {
  if (error instanceof AdminAuthError) {
    if (error.status === 401) return { error: "login_required" };
    if (error.status === 403) return { error: "forbidden" };
    if (error.message.includes("MFA")) return { error: "mfa_required" };
    return { error: "recent_auth_required" };
  }
  throw error;
}

async function requireActiveAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; state: ControlActionState }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    const locale = await getLocale();
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/control`)}`,
    );
  }

  const { data: admin, error: adminError } = await supabase
    .from("platform_admins")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (adminError || !admin) return { ok: false, state: { error: "forbidden" } };

  const limit = await rateLimit(`control-mfa:${user.id}`, "admin");
  if (!limit.success) return { ok: false, state: { error: "too_many_requests" } };

  return { ok: true, userId: user.id };
}

export async function setShopSuspension(
  _previousState: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  const parsed = setShopSuspensionSchema.safeParse({
    shopId: formData.get("shopId"),
    shopSlug: formData.get("shopSlug"),
    suspend: formData.get("suspend"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { error: "invalid_input" };

  let ctx;
  try {
    ctx = await requireRecentAuth("shops.suspend");
  } catch (error) {
    const mapped = mapAdminError(error);
    if (mapped.error === "login_required") {
      const locale = await getLocale();
      redirect(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/control`)}`,
      );
    }
    return mapped;
  }

  const limit = await rateLimit(`control:${ctx.userId}`, "admin");
  if (!limit.success) return { error: "too_many_requests" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_shop_suspension", {
    p_shop_id: parsed.data.shopId,
    p_is_suspended: parsed.data.suspend,
    p_reason: parsed.data.reason ?? null,
  });

  if (error) {
    if (error.code === "42501") return { error: "forbidden" };
    if (error.code === "22023") return { error: "invalid_input" };
    if (error.code === "28000") {
      const locale = await getLocale();
      redirect(
        `/${locale}/login?next=${encodeURIComponent(`/${locale}/control`)}`,
      );
    }
    console.error("Failed to update shop suspension", error);
    return { error: "failed" };
  }
  if (data !== true) return { error: "not_available" };

  await logAudit({
    action: parsed.data.suspend ? "shops.suspend" : "shops.restore",
    resourceType: "barbershops",
    resourceId: parsed.data.shopId,
    metadata: { slug: parsed.data.shopSlug },
  });

  const locale = await getLocale();
  revalidatePath(`/${locale}/control`);
  revalidatePath(`/${locale}/discover`);
  revalidatePath(`/${locale}/shop/${parsed.data.shopSlug}`);
  return { success: "saved" };
}

export async function enrollControlMfa(
  _previousState: ControlActionState,
  _formData: FormData,
): Promise<ControlActionState> {
  const access = await requireActiveAdmin();
  if (!access.ok) return access.state;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "QASSA Control",
  });
  if (error || !data.totp) {
    console.error("Failed to enroll Control MFA", error);
    return { error: "failed" };
  }

  return {
    success: "enrolled",
    factorId: data.id,
    secret: data.totp.secret,
    uri: data.totp.uri,
  };
}

export async function verifyControlMfa(
  _previousState: ControlActionState,
  formData: FormData,
): Promise<ControlActionState> {
  const parsed = verifyControlMfaSchema.safeParse({
    factorId: formData.get("factorId"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: "invalid_input" };

  const access = await requireActiveAdmin();
  if (!access.ok) return access.state;

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) return { error: "invalid_input" };

  const locale = await getLocale();
  redirect(`/${locale}/control`);
}
