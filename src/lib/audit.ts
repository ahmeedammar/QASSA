import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface AuditEntry {
  action: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
}

/**
 * Append-only administrative audit trail. Rows are inserted exclusively
 * through the security-definer RPC (see migration 0004); there is no update
 * or delete path from the application. Never pass secrets, tokens or full
 * personal data in metadata.
 */
export async function logAudit(entry: AuditEntry): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("log_audit_event", {
    p_action: entry.action,
    p_resource_type: entry.resourceType ?? null,
    p_resource_id: entry.resourceId ?? null,
    p_metadata: entry.metadata ?? {},
    p_success: entry.success ?? true,
  });
  if (error) {
    console.error("Failed to record administrative audit event", error);
    throw new Error("Unable to record administrative audit event.");
  }
}
