/** Shared query-param parsing for ops reporting (shareable URLs). */

export type OpsDateRange = {
  fromIso: string | null;
  toIso: string | null;
};

const DEFAULT_RANGE_DAYS = 30;

export function parseOpsDateRange(sp: URLSearchParams | Map<string, string>): OpsDateRange {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : sp.get(k) ?? null);
  const fromRaw = get("from");
  const toRaw = get("to");
  if (fromRaw && toRaw) {
    const fromMs = Date.parse(fromRaw);
    const toMs = Date.parse(toRaw);
    if (!Number.isNaN(fromMs) && !Number.isNaN(toMs) && fromMs <= toMs) {
      return { fromIso: new Date(fromMs).toISOString(), toIso: new Date(toMs).toISOString() };
    }
  }
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - DEFAULT_RANGE_DAYS);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/** Only when both from and to query params are present and valid (for explicit user-selected windows). */
export function parseOpsDateRangeExplicit(
  sp: URLSearchParams | Map<string, string>
): OpsDateRange | null {
  const get = (k: string) => (sp instanceof URLSearchParams ? sp.get(k) : sp.get(k) ?? null);
  const fromRaw = get("from");
  const toRaw = get("to");
  if (!fromRaw || !toRaw) return null;
  const fromMs = Date.parse(fromRaw);
  const toMs = Date.parse(toRaw);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) return null;
  return { fromIso: new Date(fromMs).toISOString(), toIso: new Date(toMs).toISOString() };
}

export function parseCampaignStatus(sp: URLSearchParams | Map<string, string>): string | null {
  const v = sp instanceof URLSearchParams ? sp.get("status") : sp.get("status");
  if (!v || v === "all") return null;
  const allowed = new Set(["draft", "active", "paused", "completed", "cancelled"]);
  return allowed.has(v) ? v : null;
}

export function parseSubmissionStatus(sp: URLSearchParams | Map<string, string>): string | null {
  const v = sp instanceof URLSearchParams ? sp.get("sub_status") : sp.get("sub_status");
  if (!v || v === "all") return null;
  const allowed = new Set(["pending", "approved", "rejected", "needs_revision"]);
  return allowed.has(v) ? v : null;
}

export function parseParticipantStatus(sp: URLSearchParams | Map<string, string>): string | null {
  const v = sp instanceof URLSearchParams ? sp.get("part_status") : sp.get("part_status");
  if (!v || v === "all") return null;
  const allowed = new Set(["invited", "accepted", "declined", "removed"]);
  return allowed.has(v) ? v : null;
}

export function parsePlanKeyFilter(sp: URLSearchParams | Map<string, string>): string | null {
  const v = sp instanceof URLSearchParams ? sp.get("plan") : sp.get("plan");
  if (!v || v === "all") return null;
  return v.replace(/[^a-z0-9_-]/gi, "").slice(0, 32) || null;
}

export function parseEntitlementKind(sp: URLSearchParams | Map<string, string>): string | null {
  const v = sp instanceof URLSearchParams ? sp.get("kind") : sp.get("kind");
  if (!v || v === "all") return null;
  const allowed = new Set(["comp_grant", "discount_metadata", "plan_override"]);
  return allowed.has(v) ? v : null;
}

export function parseEntitlementActiveMode(sp: URLSearchParams | Map<string, string>): "all" | "active" | "revoked" {
  const v = sp instanceof URLSearchParams ? sp.get("state") : sp.get("state");
  if (v === "active") return "active";
  if (v === "revoked") return "revoked";
  return "all";
}

export function parseSearchQ(sp: URLSearchParams | Map<string, string>, key = "q"): string {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp.get(key);
  if (!v) return "";
  return v.replace(/[%_,]/g, " ").trim().slice(0, 80);
}

export function parseUuid(sp: URLSearchParams | Map<string, string>, key: string): string | null {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp.get(key);
  if (!v) return null;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(v) ? v : null;
}

export function parsePage(sp: URLSearchParams | Map<string, string>): number {
  const v = sp instanceof URLSearchParams ? sp.get("page") : sp.get("page");
  const n = parseInt(v ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function parsePageSize(sp: URLSearchParams | Map<string, string>, fallback = 25, max = 100): number {
  const v = sp instanceof URLSearchParams ? sp.get("page_size") : sp.get("page_size");
  const n = parseInt(v ?? String(fallback), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(10, n));
}
