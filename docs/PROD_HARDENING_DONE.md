# Production Hardening — Done

**Date:** 2025-02-22  
**Scope:** Standardized API responses, rate limiting, health endpoint, admin queue observability. No changes to wallet/CDP, analytics computation, or Supabase auth flows.

---

## PART A — Standardized API responses

**File:** `apps/web/src/lib/api-response.ts`

- **ok(data?, init?)** — returns `NextResponse.json({ ok: true, ...data })`, status 200 by default.
- **fail(code, message, status?, extra?)** — returns `NextResponse.json({ ok: false, code, message, ...extra })`.
- **wrap(handler)** — optional try/catch; on throw returns `fail("INTERNAL", message, 500)`.

**Response shape**

- Success: `{ ok: true, ...data }`
- Error: `{ ok: false, code, message, ...extra }`

**Routes updated (business logic unchanged)**

- `apps/web/src/app/api/orgs/create/route.ts`
- `apps/web/src/app/api/orgs/[orgId]/members/invite/route.ts`
- `apps/web/src/app/api/analytics/ensure-backfill/route.ts`
- `apps/web/src/app/api/analytics/init-status/route.ts`
- `apps/web/src/app/api/analytics/backfill-90/route.ts`
- `apps/web/src/app/api/x/sync-handle/route.ts`
- `apps/web/src/app/api/x-sync/route.ts`
- `apps/web/src/app/api/analytics/x/route.ts`
- `apps/web/src/app/api/analytics/x/summary/route.ts`

Existing payload keys (e.g. `source`, `profile`, `rollup`) are preserved; success responses now include `ok: true`.

---

## PART B — Rate limiting

**Implementation:** Supabase-table-based (no new vendor). Atomic Postgres function.

**Migration:** `supabase/migrations/20260222100000_rate_limits.sql`

- Table: `public.rate_limits` — `key` (PK), `window_start`, `count`, `updated_at`.
- Function: `public.consume_rate_limit(p_key text, p_limit int, p_window_seconds int)` — returns `(allowed boolean, remaining int, reset_at timestamptz)`.

**Helper:** `apps/web/src/lib/rate-limit.ts`

- **rateLimit({ key, limit, windowSeconds, supabaseAdmin })** — calls RPC, returns `{ allowed, remaining, resetAt }`.
- **getClientIp(request)** — from `x-forwarded-for` or `x-real-ip`.

**Keys:** Per-user when authenticated: `{route}:u:{user.id}`. Per-IP fallback where noted.

**Limits applied**

| Endpoint                     | Limit   | Window |
|-----------------------------|---------|--------|
| orgs/create                 | 5 req   | 10 min |
| orgs/invite                 | 20 req  | 10 min |
| analytics/backfill-90       | 3 req   | 30 min |
| analytics/ensure-backfill (incl. post-login bootstrap) | 10 req | 10 min |
| x-sync                      | 5 req   | 10 min |
| x/sync-handle               | 10 req  | 10 min |

When limited: status **429**, body `{ ok: false, code: "RATE_LIMITED", message: "Too many requests. Please try again later.", resetAt }`.

Rate limiting runs only when `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) is set; otherwise the check is skipped and the request proceeds.

---

## PART C — Health endpoint

**GET /api/health**

- No auth.
- Returns: `{ ok: true, status: "ok", ts: "<ISO string>" }`.
- If service role is configured: lightweight `SELECT` on `profiles`; adds `db: "ok"` or `db: "error"` accordingly.
- Kept fast for uptime checks.

---

## PART D — Admin queue observability

**GET /api/admin/queue-status**

- **Auth:** Bearer required. User must be superadmin (email in `superadmin_emails` or `SUPERADMIN_EMAILS`).
- **Response:** `{ ok: true, analytics_jobs: { queued, running, failed, doneLast24h, oldestQueuedAt?, latestFailure? }, worker_hint }`.
- Non-admin: **403** `{ ok: false, code: "FORBIDDEN", message: "Forbidden" }`.

Queries use service role: counts by status, done in last 24h, oldest queued job (min created_at), latest failed job (order by updated_at desc).

---

## Files touched

- `apps/web/src/lib/api-response.ts` (new)
- `apps/web/src/lib/rate-limit.ts` (new)
- `supabase/migrations/20260222100000_rate_limits.sql` (new)
- `apps/web/src/app/api/health/route.ts` (new)
- `apps/web/src/app/api/admin/queue-status/route.ts` (new)
- Listed routes in PART A (imports + return values via ok/fail)
- Listed routes in PART B (rate limit check after auth)

---

## Out of scope (unchanged)

- Wallet/CDP flows
- Analytics computation (xBackfill90d, windows, source semantics)
- Supabase auth / X OAuth
- New endpoints beyond health and admin/queue-status
