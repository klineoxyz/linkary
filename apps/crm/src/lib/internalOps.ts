import type { SupabaseClient } from "@supabase/supabase-js";

export const OPS_ROLES = ["ops_super", "ops_finance", "ops_support", "ops_readonly"] as const;

export type OpsRole = (typeof OPS_ROLES)[number];

export function isOpsRole(s: string | null | undefined): s is OpsRole {
  return !!s && (OPS_ROLES as readonly string[]).includes(s);
}

/**
 * Active internal ops membership (service-role client required — table has no anon/authenticated policies).
 */
export async function getOpsMembershipRole(
  service: SupabaseClient,
  userId: string
): Promise<OpsRole | null> {
  const { data, error } = await service
    .from("internal_ops_members")
    .select("role")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .maybeSingle();

  if (error || !data?.role) return null;
  return isOpsRole(data.role) ? data.role : null;
}
