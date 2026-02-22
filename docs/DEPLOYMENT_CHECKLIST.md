# Deployment checklist

Use this before and after each production deploy.

---

## Required environment variables

### Web (Vercel / Next.js)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY` | Yes | Service role for cron, rate limits, backfill enqueue |
| `CRON_SECRET` | Yes (for cron) | Secret for protecting cron routes (header `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`) |
| `TWITTERAPI_API_KEY` | Yes (for X sync) | twitterapi.io key for profile/tweets |
| `SUPERADMIN_EMAILS` | Recommended | Comma-separated superadmin emails (fallback if `superadmin_emails` table empty) |
| `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` | Recommended | Base URL for server-side fetches (e.g. ethos, health DB check) |
| `ADMIN_BACKFILL_SECRET` | Optional | For admin backfill route (header `x-admin-secret`) |

### Worker (Railway / separate process)

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Same as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY` | Yes | Service role |
| `TWITTERAPI_API_KEY` | Yes | twitterapi.io key |

---

## Vercel cron routes

Configure in Vercel dashboard or `vercel.json` so these are called on schedule:

| Route | Suggested schedule | Purpose |
|-------|---------------------|---------|
| `POST /api/cron/x-analytics-daily` | Daily (e.g. 0 9 * * *) | Today snapshot + profile refresh for X-connected users |
| `POST /api/cron/sync-x-profiles-daily` | Daily | Sync profiles and write today to `x_daily_snapshots` |
| `POST /api/cron/backfill-x-90d-batch` | Daily or every 6h | Enqueue `x_backfill_90d` jobs for profiles without 90d |
| `POST /api/cron/sync-x-tweets-weekly` | Weekly | Optional tweets/rollups sync |

**Auth:** Each request must include `CRON_SECRET`, e.g. header `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

---

## Worker schedule

- **Command:** `pnpm --filter worker run run:jobs` (or equivalent: run the job processor).
- **Frequency:** Every 5–10 minutes (e.g. Railway cron or system cron).
- **Purpose:** Picks queued `analytics_jobs` (e.g. `x_backfill_90d`), runs them, updates status. Without this, 90d backfill never runs.

---

## Post-deploy verification

1. **Health**  
   `GET /api/health` → `{ ok: true, status: "ok", ts, db? }`. No auth.

2. **Queue status (superadmin)**  
   `GET /api/admin/queue-status` with Bearer token of a superadmin → `{ ok: true, analytics_jobs: { queued, running, failed, ... } }`.

3. **Analytics init banner**  
   Log in as a new user with X connected, open Analytics. You should see “Building your 90-day history…” until worker completes; then banner clears and backfill status reflects job/snapshot days.

4. **Org create gate**  
   As a non-company account, try creating an org → 403 with message about company accounts.

5. **Smoke script (optional)**  
   `BASE_URL=https://your-app.com node apps/web/scripts/smoke-check.js` → exit 0.

---

## References

- [ANALYTICS_DEPENDENCY_GRAPH.md](./ANALYTICS_DEPENDENCY_GRAPH.md) — routes and table ownership  
- [PROD_HARDENING_DONE.md](./PROD_HARDENING_DONE.md) — rate limits and API response shape  
- [SMOKE_TESTING.md](./SMOKE_TESTING.md) — how to run smoke checks
