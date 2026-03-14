/**
 * Privacy-safe audit logging for discovery API access.
 * Logs: user id, endpoint, timestamp, has_query (not raw query), result_count, outcome.
 * Do not log full query text or sensitive content.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type DiscoveryAuditOutcome =
  | "success"
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "validation_failed"
  | "error";

export type DiscoveryAuditEntry = {
  user_id: string;
  endpoint: string;
  has_query: boolean;
  result_count: number;
  outcome: DiscoveryAuditOutcome;
};

/**
 * Log a discovery access attempt. Uses discovery_access_log table if present;
 * otherwise logs to console in structured form for observability.
 * Keeps logs privacy-conscious (no raw query, no PII beyond user_id for auth correlation).
 */
export async function logDiscoveryAccess(
  serviceSupabase: SupabaseClient | null,
  entry: DiscoveryAuditEntry
): Promise<void> {
  const payload = {
    ...entry,
    ts: new Date().toISOString(),
  };

  if (serviceSupabase) {
    try {
      await serviceSupabase.from("discovery_access_log").insert({
        user_id: entry.user_id,
        endpoint: entry.endpoint,
        has_query: entry.has_query,
        result_count: entry.result_count,
        outcome: entry.outcome,
      });
    } catch {
      /* table may not exist yet; fall back to console */
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
        console.info("[discovery_audit]", JSON.stringify(payload));
      }
    }
  } else if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
    console.info("[discovery_audit]", JSON.stringify(payload));
  }
}
