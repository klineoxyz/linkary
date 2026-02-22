# Analytics Dependency Graph

**Purpose:** Map every entry point, table, and job for analytics/backfill so changes don’t miss a path.  
**Generated:** From repo scan (no code changes).

---

## 1. API routes (analytics + cron)

### `/api/analytics/*`

| Route | Method | File | Function | Tables read | Tables written |
|-------|--------|------|----------|-------------|----------------|
| `/api/analytics/ensure-backfill` | GET, POST | `apps/web/src/app/api/analytics/ensure-backfill/route.ts` | `ensureBackfill()` | `social_accounts`, `profiles`, `x_window_aggregates`, `analytics_jobs` | `x_daily_snapshots`, `analytics_jobs` |
| `/api/analytics/x` | GET | `apps/web/src/app/api/analytics/x/route.ts` | (inline GET) | `profiles`, `x_analytics_rollups`, `x_top_drivers`, `profile_analytics_baseline`, **analytics_snapshots**, **x_daily_snapshots**, **x_window_aggregates** | — |
| `/api/analytics/x/summary` | GET | `apps/web/src/app/api/analytics/x/summary/route.ts` | (inline GET) | **x_window_aggregates**, `profiles`, **x_daily_snapshots** | — |

### `/api/cron/*`

| Route | Method | File | Function | Tables read | Tables written |
|-------|--------|------|----------|-------------|----------------|
| `/api/cron/x-analytics-daily` | POST | `apps/web/src/app/api/cron/x-analytics-daily/route.ts` | (inline POST) | `social_accounts` | **x_daily_snapshots**, `profiles` |
| `/api/cron/backfill-x-90d-batch` | POST | `apps/web/src/app/api/cron/backfill-x-90d-batch/route.ts` | (inline POST) | `social_accounts`, `profiles` | **analytics_snapshots** (fake 90d) |
| `/api/cron/sync-x-profiles-daily` | POST | `apps/web/src/app/api/cron/sync-x-profiles-daily/route.ts` | (inline) | (cron list) | **analytics_snapshots**, profiles |
| `/api/cron/sync-x-tweets-weekly` | POST | `apps/web/src/app/api/cron/sync-x-tweets-weekly/route.ts` | (inline) | (cron list) | (tweets/rollups) |

**Auth:** Cron routes use `CRON_SECRET` (header `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`).

---

## 2. Other API routes that touch analytics tables

| Route | File | Tables touched |
|-------|------|----------------|
| `POST /api/auth/persist-social` | `apps/web/src/app/api/auth/persist-social/route.ts` | Writes `social_accounts`; **reads** `x_daily_snapshots` (count); **inserts** `analytics_jobs` (x_backfill_90d) if count < 7 |
| `POST /api/auth/sync-session-x` | `apps/web/src/app/api/auth/sync-session-x/route.ts` | Writes `social_accounts`, `profiles`; **reads** `x_daily_snapshots` (count); **inserts** `analytics_jobs` (x_backfill_90d) if count < 7 |
| `POST /api/x-sync` | `apps/web/src/app/api/x-sync/route.ts` | Writes **analytics_snapshots** (today), **x_daily_snapshots** (today); **reads** `x_daily_snapshots` (count); **inserts** `analytics_jobs` (x_backfill_90d) if count < 7 |
| `POST /api/admin/backfill-x-90d` | `apps/web/src/app/api/admin/backfill-x-90d/route.ts` | Calls `runBackfillX90d()` → writes **analytics_snapshots** (90 days same snapshot) |

---

## 3. Libs

| Lib | File | Used by | Writes |
|-----|------|---------|--------|
| `runBackfillX90d` | `apps/web/src/lib/backfill-x-90d.ts` | `POST /api/cron/backfill-x-90d-batch`, `POST /api/admin/backfill-x-90d` | **analytics_snapshots** (90 rows with same current followers/engagement) |
| `fetchXUserInfo` | `apps/web/src/lib/x-analytics-server.ts` | cron x-analytics-daily, backfill-x-90d | (external API only) |
| ensure-backfill logic | `apps/web/src/app/api/analytics/ensure-backfill/route.ts` | GET/POST ensure-backfill | `x_daily_snapshots` (today), `analytics_jobs` (enqueue) |

**No shared “enqueue only” helper yet** — ensure-backfill and persist-social/sync-session-x/x-sync each have their own enqueue + today snapshot logic.

---

## 4. Worker (canonical 90d backfill)

| Entry | File | Function | Tables read | Tables written |
|-------|------|----------|-------------|----------------|
| Job runner | `apps/worker/src/run_analytics_jobs.ts` | `main()` | `analytics_jobs` | `analytics_jobs` (status, run_after, last_error) |
| x_backfill_90d handler | `apps/worker/src/jobs/xBackfill90d.ts` | `runXBackfill90d()` | (twitterapi.io: user info + tweets) | **x_daily_snapshots** (per day from tweets), **x_window_aggregates** (7/30/90) |

**Invocation:** `pnpm run run:jobs` (or Railway cron every 5–10 min). Picks one `analytics_jobs` row with `status = 'queued'` and `run_after <= now()`, marks running, calls `runXBackfill90d`, then marks done or re-queues with backoff.

---

## 5. Table ownership (who writes / who reads)

| Table | Written by | Read by |
|-------|------------|--------|
| **x_daily_snapshots** | ensure-backfill (today), cron x-analytics-daily (today), x-sync (today), **worker xBackfill90d** (per day from tweets) | ensure-backfill (none for write path), analytics/x, analytics/x/summary, persist-social, sync-session-x, x-sync, publicData (window agg), worker (to compute aggregates) |
| **x_window_aggregates** | **Worker xBackfill90d only** | ensure-backfill (check has 90d), analytics/x, analytics/x/summary, publicData |
| **analytics_jobs** | ensure-backfill, persist-social, sync-session-x, x-sync | ensure-backfill (dedup), worker run_analytics_jobs |
| **analytics_snapshots** | **lib/backfill-x-90d** (cron backfill-x-90d-batch, admin backfill-x-90d), cron sync-x-profiles-daily, x-sync (today) | analytics/x (fallback), publicData (profile + org) |
| **profiles** (analytics cols) | cron x-analytics-daily (followers_total, etc.) | (everywhere) |

---

## 6. First-time user flow (X connect → backfill → UI)

```
1. User signs in with X (Supabase OAuth)
   → auth callback: apps/web/src/app/auth/callback/page.tsx
   → calls POST /api/analytics/ensure-backfill (and/or ensure-social-x, connect-x-callback)

2. ensure-backfill (GET or POST)
   → apps/web/src/app/api/analytics/ensure-backfill/route.ts :: ensureBackfill()
   → Resolve handle from social_accounts / profiles
   → Upsert TODAY into x_daily_snapshots (owner_type=profile, owner_id, day=today)
   → If no 90d row in x_window_aggregates and no recent job in analytics_jobs: INSERT analytics_jobs (job_type=x_backfill_90d, payload={ username, user_id })
   → Return { enqueued: true } or { enqueued: false, reason }

3. Other enqueue entry points (same job type):
   → POST /api/auth/persist-social (if x_daily_snapshots count < 7)
   → POST /api/auth/sync-session-x (if x_daily_snapshots count < 7)
   → POST /api/x-sync (if x_daily_snapshots count < 7)

4. Worker (run_analytics_jobs)
   → apps/worker/src/run_analytics_jobs.ts :: main()
   → SELECT analytics_jobs WHERE status=queued AND run_after<=now() LIMIT 1
   → UPDATE analytics_jobs SET status=running
   → runXBackfill90d(supabase, job) in apps/worker/src/jobs/xBackfill90d.ts
     - Fetch user info (followers now) + recent tweets (twitterapi.io)
     - Bucket tweets by day; upsert x_daily_snapshots per day (followers only for today)
     - Compute 7/30/90 from x_daily_snapshots; upsert x_window_aggregates
   → UPDATE analytics_jobs SET status=done (or re-queue with backoff on failure)

5. UI reads
   → Analytics tab: fetch /api/analytics/x and /api/analytics/x/summary
   → apps/web/src/figma/app/components/AnalyticsTabContent.tsx, AnalyticsPage.tsx
   → api/analytics/x uses x_daily_snapshots + x_window_aggregates (and falls back to analytics_snapshots + legacy tables)
   → api/analytics/x/summary uses x_window_aggregates + x_daily_snapshots count (is_backfilling)
```

---

## 7. Flow diagram (text)

```
                    ┌─────────────────────────────────────────────────────────────────┐
                    │                     USER CONNECTS X                             │
                    │  (OAuth callback / persist-social / sync-session-x / x-sync)     │
                    └────────────────────────────┬────────────────────────────────────┘
                                                 │
                    ┌────────────────────────────▼────────────────────────────────────┐
                    │  POST /api/analytics/ensure-backfill (or other enqueue paths)   │
                    │  • Write TODAY → x_daily_snapshots                              │
                    │  • If no 90d aggregate: INSERT analytics_jobs (x_backfill_90d) │
                    └────────────────────────────┬────────────────────────────────────┘
                                                 │
                    ┌────────────────────────────▼────────────────────────────────────┐
                    │  Worker: run_analytics_jobs.ts → runXBackfill90d (xBackfill90d)  │
                    │  • Fetch tweets + user info (twitterapi.io)                      │
                    │  • Write per-day → x_daily_snapshots                            │
                    │  • Write 7/30/90 → x_window_aggregates                          │
                    │  • Mark job done                                                │
                    └────────────────────────────┬────────────────────────────────────┘
                                                 │
                    ┌────────────────────────────▼────────────────────────────────────┐
                    │  UI: GET /api/analytics/x, GET /api/analytics/x/summary          │
                    │  • Read x_daily_snapshots, x_window_aggregates                  │
                    │  • Fallback: analytics_snapshots, legacy rollups                │
                    └─────────────────────────────────────────────────────────────────┘

  FAKE PATH (to remove/repurpose):
  POST /api/cron/backfill-x-90d-batch
       → runBackfillX90d (lib/backfill-x-90d.ts)
       → Writes SAME snapshot 90 times → analytics_snapshots (wrong table, fake history)
```

---

## 8. What should be deleted or repurposed

| Item | Action | Reason |
|------|--------|--------|
| **POST /api/cron/backfill-x-90d-batch** | Repurpose to **only enqueue** x_backfill_90d jobs (no snapshot writes), **or** return 410 Gone and remove from cron config | Currently calls `runBackfillX90d()` which writes 90 identical rows to **analytics_snapshots** (current followers/engagement repeated). Wrong table and not real history. Real 90d comes only from worker → x_daily_snapshots + x_window_aggregates. |
| **lib/backfill-x-90d.ts** `runBackfillX90d()` | Do not use for 90d backfill. Optionally keep for admin “bulk enqueue” only (no writes to analytics_snapshots) or delete | Same as above; fabricates 90d in analytics_snapshots. |
| **POST /api/admin/backfill-x-90d** | Change to enqueue jobs only (or call same enqueue logic as ensure-backfill), or document as “legacy / do not use for 90d” | Currently writes to analytics_snapshots via runBackfillX90d. |

**Keep as-is:**  
- ensure-backfill (writes today + enqueues job).  
- Worker (only writer of real 90d: x_daily_snapshots + x_window_aggregates).  
- Cron x-analytics-daily (writes today to x_daily_snapshots + profiles).  
- GET /api/analytics/x and /api/analytics/x/summary (read path; can prefer x_daily_snapshots + x_window_aggregates and treat analytics_snapshots as fallback until migration).

---

## 9. File paths quick reference

| Purpose | Path |
|---------|------|
| Ensure backfill (enqueue + today) | `apps/web/src/app/api/analytics/ensure-backfill/route.ts` |
| Analytics data (full) | `apps/web/src/app/api/analytics/x/route.ts` |
| Analytics summary (windows) | `apps/web/src/app/api/analytics/x/summary/route.ts` |
| Cron daily snapshot | `apps/web/src/app/api/cron/x-analytics-daily/route.ts` |
| Cron fake 90d (repurpose/remove) | `apps/web/src/app/api/cron/backfill-x-90d-batch/route.ts` |
| Fake 90d lib | `apps/web/src/lib/backfill-x-90d.ts` |
| Worker entry | `apps/worker/src/run_analytics_jobs.ts` |
| Worker x_backfill_90d | `apps/worker/src/jobs/xBackfill90d.ts` |
| Persist social (enqueue) | `apps/web/src/app/api/auth/persist-social/route.ts` |
| Sync session X (enqueue) | `apps/web/src/app/api/auth/sync-session-x/route.ts` |
| X-sync (today + enqueue) | `apps/web/src/app/api/x-sync/route.ts` |
| Auth callback (calls ensure-backfill) | `apps/web/src/app/auth/callback/page.tsx` |
| App.tsx (ensure-backfill) | `apps/web/src/figma/app/App.tsx` |
| Public one-pager (ensure-backfill) | `apps/web/src/app/(public)/[username]/PublicOnePagerWrapper.tsx` |
| Analytics UI | `apps/web/src/figma/app/components/AnalyticsPage.tsx`, `AnalyticsTabContent.tsx` |
