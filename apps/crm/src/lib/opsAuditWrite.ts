import type { SupabaseClient } from "@supabase/supabase-js";

export type AuditInsert = {
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  payload_json: Record<string, unknown>;
  reason: string;
};

export async function insertPlatformAuditLog(
  service: SupabaseClient,
  row: AuditInsert
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await service.from("platform_audit_log").insert({
    actor_user_id: row.actor_user_id,
    action: row.action,
    target_type: row.target_type,
    target_id: row.target_id,
    payload_json: row.payload_json,
    reason: row.reason,
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
