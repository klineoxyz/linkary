# Analytics refresh & owner status (product + QA)

## Part 1 — Refresh/sync endpoints (audited)

| Endpoint | What it does | Rate limit | Abuse / cost |
|----------|----------------|------------|--------------|
| **POST /api/x-sync** | Live twitterapi.io `user/info`, updates profile + today snapshot, **enqueues** `x_backfill_90d`. No tweet list in this request. | **5 / 10 min** per user + **24h cooldown** after successful profile sync | Moderate: one external API call per allowed sync; cooldown limits cost. |
| **POST /api/analytics/x/rebuild** | **Only** inserts `analytics_jobs` row `x_backfill_90d` (or returns existing queued/running job). Worker does tweet fetch + DB writes. | **3 / hour** per user (after this pass). Existing queued/running job returns **without** consuming rate limit. | Safer for “refresh analytics data” than x-sync spam: no live fetch on Vercel; cost is worker-side. |

**Recommendation**

- **User-facing “Request analytics refresh”** → **POST /api/analytics/x/rebuild** (with rate limit). Async, clear expectation, no page-load twitterapi.io.
- **Integrations “Sync from X”** → keep **POST /api/x-sync** for profile/follower touch + enqueue backfill; stricter cooldown appropriate there.

**Operator-only**

- Cron/worker batch jobs, admin backfill routes unchanged.

---

## Part 2 — Owner UX (implemented)

- Main **Analytics** page (own X tab): **Request analytics refresh** button + short copy (“queues background update… few requests per hour”).
- **Cross-user analytics**: no refresh, no private sync timestamps (unchanged).

---

## Part 3 — `owner_analytics_state` (GET /api/analytics/init-status)

Derived **only** from DB: `profiles` (handle, `x_last_profile_sync_at`, `analytics_initialized_at`), `x_daily_snapshots` counts, `x_window_aggregates`, latest `analytics_jobs` row for `x_backfill_90d`.

| State | Meaning |
|-------|--------|
| `no_x_handle` | No `twitter_username` / `username` on profile. |
| `never_synced` | Has handle, not initialized, no snapshot rows yet. |
| `queued_or_building` | Latest job `status` ∈ `queued`, `running`. |
| `refresh_failed` | Latest job `status` = `failed` and `last_error` set. |
| `partial_data` | Not fully initialized but has some snapshot/today row. |
| `ready_stale` | Initialized + `x_last_profile_sync_at` older than **7 days** + not building. |
| `ready_recent` | Initialized and not stale (or no sync timestamp). |

**Window-only “no activity”** stays on **GET /api/analytics/x** (`posts_total === 0` in window); not a separate server enum.

---

## Part 4 — Consistency

- **Analytics page**: uses `init-status` for state banner + refresh button; **GET /api/analytics/x** for numbers + `freshness` line.
- **AnalyticsTabContent** (embedded tab): same **GET /api/analytics/init-status** shape; extra fields (`owner_analytics_state`, `has_x_handle`, …) are backward compatible.
- **Integrations**: x-sync remains the place for full “Sync from X” (profile + enqueue).

---

## Part 5 — QA checklist

1. **Refresh request**  
   - Logged-in user with X handle → Analytics → **Request analytics refresh** → 200, job queued (or “already queued”).  
   - Supabase `analytics_jobs`: new row or existing `queued`/`running` for that `owner_id`.

2. **Rate limit**  
   - More than **3** successful new enqueue attempts in **1 hour** (no prior queued job) → **429** + message.  
   - Repeated clicks while job already queued → **200** `existing: true`, no extra jobs.

3. **States**  
   - No X handle → `no_x_handle`, button hidden.  
   - Job running → `queued_or_building`, banner + disabled button label “Update queued…”.  
   - Failed job → `refresh_failed` banner.  
   - Old `x_last_profile_sync_at` → `ready_stale` banner.

4. **Logs**  
   - Worker: `[X_BACKFILL_90D]` stages after job runs.

5. **Cross-user**  
   - No refresh control; no regression on `/api/me/analytics/profile/[username]`.

---

## What users can do vs operator

| Users (own analytics) | Operators |
|------------------------|-----------|
| Request analytics refresh (rebuild job, rate-limited) | Worker/cron, admin backfill, fix failed jobs |
| Sync from X in Integrations (x-sync, 24h cooldown) | twitterapi.io keys, Railway logs, DB repair |
