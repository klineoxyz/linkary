import { normalizePlanKey, type PlanKey, PLAN_KEYS } from "@/lib/planKey";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OPS_COMP_SCOPES = [
  "discovery",
  "analytics_full",
  "background_ingest",
  "self_serve_90d",
] as const;

export type OpsCompScope = (typeof OPS_COMP_SCOPES)[number];

const SCOPE_SET = new Set<string>(OPS_COMP_SCOPES);

export function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export function parseRequiredReason(body: Record<string, unknown>): string | null {
  const r = body.reason;
  if (typeof r !== "string") return null;
  const t = r.trim();
  if (t.length < 3) return null;
  return t;
}

export function parseExpiresAt(body: Record<string, unknown>): string | null {
  const e = body.expires_at;
  if (typeof e !== "string") return null;
  const d = Date.parse(e);
  if (Number.isNaN(d)) return null;
  if (d <= Date.now()) return null;
  return new Date(d).toISOString();
}

export function parseSubject(
  body: Record<string, unknown>
): { subject_type: "profile" | "org"; subject_id: string } | null {
  const st = body.subject_type;
  const sid = body.subject_id;
  if (st !== "profile" && st !== "org") return null;
  if (typeof sid !== "string" || !isUuid(sid)) return null;
  return { subject_type: st, subject_id: sid.trim().toLowerCase() };
}

export function parseScopes(body: Record<string, unknown>): OpsCompScope[] | null {
  const raw = body.scopes;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: OpsCompScope[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string" || !SCOPE_SET.has(x)) return null;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x as OpsCompScope);
  }
  return out.length ? out : null;
}

export function parsePlanKeyField(body: Record<string, unknown>): PlanKey | null {
  const pk = body.plan_key;
  if (typeof pk !== "string") return null;
  const n = normalizePlanKey(pk);
  if (!n || !(PLAN_KEYS as readonly string[]).includes(n)) return null;
  return n;
}

export function parseDiscountPayload(body: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {};
  if (typeof body.stripe_coupon_id === "string" && body.stripe_coupon_id.trim()) {
    extra.stripe_coupon_id = body.stripe_coupon_id.trim();
  }
  if (typeof body.stripe_customer_id === "string" && body.stripe_customer_id.trim()) {
    extra.stripe_customer_id = body.stripe_customer_id.trim();
  }
  if (typeof body.percent_off === "number" && Number.isFinite(body.percent_off)) {
    extra.percent_off = body.percent_off;
  }
  if (typeof body.notes === "string" && body.notes.trim()) {
    extra.notes = body.notes.trim();
  }
  return extra;
}
