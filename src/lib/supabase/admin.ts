import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client. Server-only import; the key must never reach the browser.
 * Use ONLY for operations that genuinely require elevated privileges (e.g.
 * provisioning), and only AFTER the caller's permission has been verified with
 * requireAdmin(). Never use this to bypass authorization.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
