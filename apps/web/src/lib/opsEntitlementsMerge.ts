import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlanKey, type PlanKey } from "@/lib/planKey";

export const COMP_SCOPE_VALUES = [
  "discovery",
  "analytics_full",
  "background_ingest",
  "self_serve_90d",
] as const;

export type CompScope = (typeof COMP_SCOPE_VALUES)[number];

const SCOPE_SET = new Set<string>(COMP_SCOPE_VALUES);

function isCompScope(s: string): s is CompScope {
  return SCOPE_SET.has(s);
}

const TABLE = "platform_ops_entitlements";

function nowIso(): string {
  return new Date().toISOString();
}

/** Newest active plan_override per subject (profile batch). */
export async function fetchActivePlanOverrideMapForProfiles(
  service: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, PlanKey>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  const out = new Map<string, PlanKey>();
  if (unique.length === 0) return out;

  const { data } = await service
    .from(TABLE)
    .select("subject_id, payload_json, created_at")
    .eq("subject_type", "profile")
    .eq("kind", "plan_override")
    .in("subject_id", unique)
    .is("revoked_at", null)
    .gt("expires_at", nowIso())
    .order("created_at", { ascending: false });

  for (const row of data ?? []) {
    const sid = String((row as { subject_id: string }).subject_id);
    if (out.has(sid)) continue;
    const raw = (row as { payload_json?: { plan_key?: string | null } }).payload_json;
    const pk = normalizePlanKey(raw?.plan_key ?? null);
    if (pk) out.set(sid, pk);
  }
  return out;
}

/** Active plan override for a single org (newest). */
export async function fetchActivePlanOverrideForOrg(
  service: SupabaseClient,
  orgId: string
): Promise<PlanKey | null> {
  const { data } = await service
    .from(TABLE)
    .select("payload_json, created_at")
    .eq("subject_type", "org")
    .eq("subject_id", orgId)
    .eq("kind", "plan_override")
    .is("revoked_at", null)
    .gt("expires_at", nowIso())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const raw = (data as { payload_json?: { plan_key?: string | null } }).payload_json;
  return normalizePlanKey(raw?.plan_key ?? null);
}

/** Merge comp scopes for many profiles (union of all active comp rows). */
export async function buildProfileCompScopesMap(
  service: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, Set<CompScope>>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  const out = new Map<string, Set<CompScope>>();
  if (unique.length === 0) return out;

  const { data } = await service
    .from(TABLE)
    .select("subject_id, payload_json")
    .eq("subject_type", "profile")
    .eq("kind", "comp_grant")
    .in("subject_id", unique)
    .is("revoked_at", null)
    .gt("expires_at", nowIso());

  for (const row of data ?? []) {
    const sid = String((row as { subject_id: string }).subject_id);
    const scopes = (row as { payload_json?: { scopes?: unknown } }).payload_json?.scopes;
    if (!Array.isArray(scopes)) continue;
    const set = out.get(sid) ?? new Set<CompScope>();
    for (const s of scopes) {
      if (typeof s === "string" && isCompScope(s)) set.add(s);
    }
    out.set(sid, set);
  }
  return out;
}

export async function profileHasCompScope(
  service: SupabaseClient,
  profileId: string,
  scope: CompScope
): Promise<boolean> {
  const map = await buildProfileCompScopesMap(service, [profileId]);
  return map.get(profileId)?.has(scope) ?? false;
}
