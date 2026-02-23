# Ops Runbook V1 — Production Readiness

Repo-grounded runbook for verifying env, readiness, worker, and cron before onboarding users.

---

## Required environment variables

### Vercel (Next.js app)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key for client auth |
| `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY` | Yes | Service client (rate limits, public profile, ensure-backfill, owner preview) |
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | Auth callback redirect; e.g. `https://linkary.xyz` |
| `CRON_SECRET` | Yes (if using cron) | Protects `/api/cron/*` routes |
| `TWITTERAPI_API_KEY` | Yes for X analytics | twitterapi.io; cron and worker |
| `ETHOS_CLIENT_ID` | Optional | Ethos API; default `linkary@1` |
| `SUPERADMIN_EMAILS` | Optional | Comma-separated emails for admin/queue-status |
| `OPS_ENABLED` | Optional | If set (e.g. `true`), `/ops` page is reachable without auth |

### Railway (worker)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY` | Yes | Service client for `analytics_jobs` |
| `TWITTERAPI_API_KEY` | Yes | twitterapi.io for 90d backfill |

---

## Verify readiness endpoint

1. **Call the readiness API** (no auth):

   ```bash
   curl -s https://your-domain.com/api/readiness
   ```

2. **Expected when healthy** (HTTP 200):

   ```json
   {
     "ok": true,
     "checks": {
       "serviceSupabase": { "ok": true, "detail": "service client created" },
       "rateLimitRpc": { "ok": true, "detail": "allowed" },
       "analyticsQueue": { "ok": true, "detail": "counts read", "queued": 0, "running": 0, "done": 5, "failed": 0 },
       "cronConfigured": { "ok": true },
       "twitterApiConfigured": { "ok": true },
       "ethosConfigured": { "ok": true, "detail": "optional; ETHOS_CLIENT_ID has default" }
     }
   }
   ```

3. **When service key or RPC is missing** (HTTP 503):

   - `ok: false`, `code: "CONFIG"`, and the same `checks` object so you can see which dependency failed.
   - Fix: set `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) in Vercel and ensure the `rate_limits` table and `consume_rate_limit` RPC exist (migration `20260222100000_rate_limits.sql`).

---

## Verify worker is draining analytics_jobs

1. **Queue status** (superadmin only; requires Bearer token):

   ```bash
   curl -s -H "Authorization: Bearer YOUR_JWT" https://your-domain.com/api/admin/queue-status
   ```

   Check `analytics_jobs.queued` and `analytics_jobs.running`. If the worker is running, `queued` should drain over time and `doneLast24h` should increase.

2. **Readiness** (no auth) includes queue counts:

   - `checks.analyticsQueue.queued`, `.running`, `.done`, `.failed`. High `queued` with no `running` suggests the worker is not running or not hitting the right env.

3. **Worker command** (Railway or local):

   - Run the job processor periodically (e.g. every 5–10 min):  
     `pnpm --filter worker run run:jobs`  
   - Or use a cron that POSTs to `/api/cron/backfill-x-90d-batch` (with `CRON_SECRET`) to enqueue jobs; the worker still must run to process them.

---

## Manually trigger cron

Cron routes require `CRON_SECRET` in the request (header or Bearer).

**Example: trigger daily X analytics snapshot**

```bash
curl -X POST "https://your-domain.com/api/cron/x-analytics-daily" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
# or
curl -X POST "https://your-domain.com/api/cron/x-analytics-daily" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Example: enqueue 90d backfill jobs (batch)**

```bash
curl -X POST "https://your-domain.com/api/cron/backfill-x-90d-batch" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Replace `YOUR_CRON_SECRET` with the value of `CRON_SECRET` in Vercel. Never commit or log the secret.

---

## Analytics stuck "partial"

If the public page or dashboard shows analytics as "partial" or "fallback":

1. **Readiness**  
   - Confirm `serviceSupabase` and `rateLimitRpc` are ok.  
   - Confirm `twitterApiConfigured` is true if you use X analytics.

2. **Ensure-backfill**  
   - User (or you as that user) can retry: from the app, use the "Retry" action shown when analytics init fails (auth callback or in-app banner/toast).  
   - Or call with a valid user JWT:  
     `curl -X POST "https://your-domain.com/api/analytics/ensure-backfill" -H "Authorization: Bearer USER_JWT"`  
   - Rate limit: 10 requests per 10 minutes per user.

3. **Worker**  
   - Ensure the worker process is running and has `SUPABASE_SERVICE_ROLE_KEY` and `TWITTERAPI_API_KEY`.  
   - Check queue-status: if `queued` grows and never decreases, the worker is not running or is failing (check worker logs and `last_error` in queue-status).

4. **Cron**  
   - If you rely on cron to enqueue 90d jobs, ensure the cron job is configured (e.g. Vercel Cron or external) to POST to `/api/cron/backfill-x-90d-batch` with `CRON_SECRET`.

5. **No X handle**  
   - If the user has not connected X or the handle is missing, ensure-backfill returns `enqueued: false`, reason `no_x_handle`. Connect X in Integrations and try again.

---

## Internal ops page

- **URL:** `https://your-domain.com/ops` (route: `apps/web/src/app/(internal)/ops/page.tsx`).
- **Access:** Allowed when the user is authenticated **or** `OPS_ENABLED` is set (any non-empty value). If not allowed, the page redirects to `/login`.
- **Contents:** Links to `/api/readiness`, `/api/admin/queue-status` (for superadmins), and short instructions for brochure mode and owner preview. The page calls `GET /api/ops/check` (with Bearer token if logged in) to determine access; do not expose secrets on the page.
