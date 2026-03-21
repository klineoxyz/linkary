import type { SupabaseClient } from "@supabase/supabase-js";
import type { OpsEntitlementKind } from "@/lib/opsWritePermissions";

const TABLE = "platform_ops_entitlements";

/** Set revoked_at for all non-revoked rows for subject + kind (reversible; no DELETE). */
export async function softRevokeActiveBySubjectKind(
  service: SupabaseClient,
  subject_type: "profile" | "org",
  subject_id: string,
  kind: OpsEntitlementKind
): Promise<{ error: string | null; revokedIds: string[] }> {
  const { data: rows, error: selErr } = await service
    .from(TABLE)
    .select("id")
    .eq("subject_type", subject_type)
    .eq("subject_id", subject_id)
    .eq("kind", kind)
    .is("revoked_at", null);

  if (selErr) return { error: selErr.message, revokedIds: [] };
  const ids = (rows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  if (ids.length === 0) return { error: null, revokedIds: [] };

  const now = new Date().toISOString();
  const { error: updErr } = await service.from(TABLE).update({ revoked_at: now }).in("id", ids);
  if (updErr) return { error: updErr.message, revokedIds: [] };
  return { error: null, revokedIds: ids };
}
