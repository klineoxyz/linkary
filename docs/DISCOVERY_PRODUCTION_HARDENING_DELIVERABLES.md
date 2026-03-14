# Discovery Production Hardening — Deliverables

**Mission:** Harden Linkary discovery for production so it is safe for controlled beta and future paid rollout. No redesign, no full search UI, no privacy regression.

---

## 1. Exact files changed (this pass)

| File | Change |
|------|--------|
| `apps/web/src/lib/discoveryConstants.ts` | **New.** Centralized `DISCOVERY_RATE_LIMIT` (60), `DISCOVERY_RATE_WINDOW_SEC` (60), with policy comment. |
| `apps/web/src/lib/entitlementDiscovery.ts` | Added "WHERE TO PLUG IN PAID PLANS LATER" comment block at step 4 with example and exact placement. |
| `apps/web/src/app/api/me/discovery/profiles/route.ts` | Import rate limit constants from `discoveryConstants`; removed unused `getClientIp`. |
| `apps/web/src/app/api/me/discovery/orgs/route.ts` | Import rate limit constants from `discoveryConstants`. |
| `apps/web/src/lib/discoveryResponseShape.ts` | JSDoc clarified: only allowlisted keys copied so upstream/serialization cannot leak forbidden fields. |
| `apps/web/src/lib/entitlementDiscovery.test.ts` | **New.** Unit tests for entitlement outcome shape and isEligibleForDiscovery. |
| `docs/DISCOVERY_PRODUCTION_HARDENING_DELIVERABLES.md` | **New.** This document. |

**Existing (unchanged) production-hardening pieces:**

- `entitlementDiscovery.ts` — Layered entitlement (admin → allowlist → feature_flag → future billing).
- `discoveryValidation.ts` — Query validation, limit/offset clamp, q trim/cap/sanitize.
- `discoveryResponseShape.ts` — Allowlist-only response shaping; forbidden-field stripping.
- `discoveryAuditLog.ts` — Privacy-safe audit (user_id, endpoint, has_query, result_count, outcome).
- `supabase/migrations/20260402000000_discovery_access_log.sql` — Table for audit log.
- Both discovery routes — Auth, entitlement, rate limit, validation, shaping, audit logging.

---

## 2. Entitlement structure implemented

**Order (first match wins):**

1. **Admin override** — User email in `superadmin_emails` or `SUPERADMIN_EMAILS` env → `{ eligible: true, reason: "admin" }`. Requires service Supabase.
2. **Internal allowlist** — User id in `LINKARY_DISCOVERY_ALLOWED_USER_IDS` (comma-separated) → `{ eligible: true, reason: "allowlist" }`.
3. **Feature flag** — `LINKARY_DISCOVERY_ELIGIBLE=true` → `{ eligible: true, reason: "feature_flag" }`.
4. **Future: billing/plan gate** — Not implemented. Documented in code: add a query to subscriptions/entitlements by userId; if active plan includes discovery, return `{ eligible: true, reason: "billing" }`. Exact insertion point and example are in `entitlementDiscovery.ts` at step 4.

**Outcomes:** `DiscoveryEligibilityOutcome` = eligible (admin | allowlist | feature_flag | billing) or not_eligible. `isEligibleForDiscovery()` is a convenience wrapper returning boolean.

**Where paid-plan logic will plug in:** In `checkDiscoveryEligibility`, after the feature-flag check and before `return { eligible: false, reason: "not_eligible" }`, add the billing query and return `{ eligible: true, reason: "billing" }` when the user has an active discovery-capable plan.

---

## 3. Rate limiting approach

- **Mechanism:** Supabase RPC `consume_rate_limit` (see `rate-limit.ts` and migration `20260222100000_rate_limits.sql`).
- **Key:** `discovery:u:{userId}` (per authenticated user). No IP fallback; discovery requires auth, so 401 before rate limit is applied.
- **Policy:** 60 requests per 60 seconds per user (constants in `discoveryConstants.ts`).
- **When exceeded:** 429, `RATE_LIMITED`, body includes `resetAt` (ISO). Audit outcome `rate_limited`.
- **Applied in:** Both `GET /api/me/discovery/profiles` and `GET /api/me/discovery/orgs`, after entitlement and before running the query.

---

## 4. Validation rules added

- **limit:** Integer, default 20, min 1, max 100 (clamped). Invalid/negative → default.
- **offset:** Integer, default 0, min 0, max 10_000 (clamped). Invalid/negative → 0.
- **q:** Optional string; trimmed, single-space normalized, max length 200 (capped); `*` and `%` removed to avoid wildcard abuse. Empty after sanitize → undefined.
- **Behavior:** Normalize/clamp only; no 400 for malformed params (client-friendly for beta). Can add strict rejection later if needed.
- **Exports:** `DISCOVERY_MIN_LIMIT`, `DISCOVERY_MAX_LIMIT`, `DISCOVERY_DEFAULT_LIMIT`, `DISCOVERY_MAX_OFFSET`, `DISCOVERY_QUERY_MAX_LENGTH` from `discoveryValidation.ts`.

---

## 5. Logging / observability

- **Table:** `discovery_access_log` (service_role only; RLS on; no anon/authenticated access). Columns: `id`, `user_id`, `endpoint`, `has_query`, `result_count`, `outcome`, `created_at`.
- **Logged:** user_id, endpoint, has_query (boolean; no raw query text), result_count, outcome. No PII beyond user_id for auth correlation.
- **Outcomes:** success | unauthorized | forbidden | rate_limited | validation_failed | error.
- **Insert:** Via `logDiscoveryAccess()` in `discoveryAuditLog.ts`. If table missing, falls back to console (structured JSON).
- **Use:** Monitor abuse, beta usage, and entitlement/rate-limit failures without over-collecting.

---

## 6. Tests added

- **Unit (existing):** `discoveryValidation.test.ts` — `validateDiscoveryQuery` (defaults, clamp, trim, cap, sanitize); `shapeDiscoveryProfileForResponse` / `shapeDiscoveryOrgForResponse` (no forbidden fields in output; allowlisted fields preserved). Run: `pnpm exec tsx apps/web/src/lib/discoveryValidation.test.ts`.
- **Unit (new):** `entitlementDiscovery.test.ts` — `checkDiscoveryEligibility` outcome shape (eligible boolean and reason); `isEligibleForDiscovery` returns boolean and matches outcome. Run: `pnpm exec tsx apps/web/src/lib/entitlementDiscovery.test.ts`.
- **Manual QA checklist:** Below (section 7). No additional automated API tests in this pass; 401/403/429 and payload checks are manual or can be covered by e2e later.

---

## 7. Manual QA checklist

- [ ] **Authenticated eligible user** — Valid token + eligible (allowlist or feature flag or admin): GET profiles/orgs returns 200 and allowlisted payload only.
- [ ] **Authenticated non-eligible user** — Valid token, not in allowlist and flag off: 403 DISCOVERY_NOT_ELIGIBLE; no discovery data.
- [ ] **Anonymous** — No token or invalid token: 401; no discovery data.
- [ ] **Rate limit exceeded** — After 60 requests in 1 minute per user: 429 RATE_LIMITED, body has resetAt; audit outcome rate_limited.
- [ ] **Malformed query** — e.g. limit=abc or offset=-1: request still succeeds with normalized limit/offset (default/0).
- [ ] **Limit/offset clamped** — limit=999 → 100; offset=999999 → 10000; response respects clamped values.
- [ ] **No email in payload** — Inspect JSON; no `email` or `contact_email` in any profile/org object.
- [ ] **No exact location in payload** — No `location`, `street`, `city`.
- [ ] **No pricing in payload** — No `pricing`, `pricing_notes`, or pricing inside `meta`.
- [ ] **No auth/account ids in payload** — No `user_id`, `id` (internal), or auth identifiers.
- [ ] **No meta/private metadata in payload** — No `meta` or private metadata fields.
- [ ] **Public profile unchanged** — /{username} and /api/public/profile behave as before.
- [ ] **/analytics ownership unchanged** — Deep analytics remain owner-only; discovery uses only approved snapshot fields.

---

## 8. Remaining risks

- **Rate limit bypass if RPC fails:** On `consume_rate_limit` error, `rate-limit.ts` currently allows the request (fail-open). For stricter beta, consider fail-closed or alerting.
- **Discovery_access_log growth:** No TTL or retention in migration; add retention policy or archival if usage grows.
- **Billing not implemented:** Eligibility is env/allowlist/admin only until paid plans are wired in step 4 of entitlement.

---

## 9. Intentionally deferred

- Full search UI and ranking (discovery remains snapshot-oriented, order by username/slug).
- Billing/checkout and paid-plan check in entitlement (placeholder and doc only).
- Strict validation that returns 400 for invalid limit/offset (current: normalize only).
- IP-based rate limit fallback for unauthenticated discovery (discovery is auth-only).
- Moving discovery from public views to a dedicated discovery view/RPC (documented as future option if discovery-safe but non-public fields are needed later).
- E2E or API integration tests for 401/403/429 (manual checklist for now).

---

## 10. Architecture reminders

- Discovery is not coupled to owner payloads; it uses its own service and allowlisted views.
- Discovery is authenticated only; no public discovery surface.
- Public profile routes and behavior are unchanged.
- When to move to a dedicated discovery view/RPC: when discovery needs fields that are safe for discovery but should not be on the public profile view; until then, reusing public views with an explicit column allowlist is acceptable.
