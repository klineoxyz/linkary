import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlanKey, type PlanKey } from "./planKey.js";

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
