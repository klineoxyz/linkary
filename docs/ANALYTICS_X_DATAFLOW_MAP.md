# X Analytics Data Flow Map — Source of Truth

Single source of truth for `/analytics`: what the UI uses, which DB tables are authoritative, who writes what, and how to verify data.

**No code in this doc.** Code changes are in the repo; this doc maps the contract.

---

## 1) Exact list of analytics UI elements and which fields they use from `/api/analytics/x`

Every element on the Analytics page (X platform) and the exact response fields it reads.

| UI element | Response fields used |
|------------|----------------------|
| **Follower Growth chart** | `chart_points.follower_growth` (array of `{ date, follower_delta }`). `follower_data_coverage_days`, `follower_window_days`, `follower_earliest_snapshot_date` for coverage/empty state. |
| **Engagement Rate chart** | `chart_points.engagement_rate` (array of `{ date, engagement_pct, posts }`). `engagement_data_coverage_days`, `window_days`, `tweet_count_window`, `engagement_rate_pct` for coverage/empty/summary. |
| **Posting Cadence chart** | `chart_points.posting_cadence` (array of `{ date, posts }`). `tweet_count_window`, `window_days` for coverage/summary. |
| **KPI: Followers** | `profile.followers_total`. Deltas: `snapshots` (from x_daily_snapshots) or window summary; `baseline.followers_total`. |
| **KPI: Engagement Rate** | `rollup.engagement_rate_7d` / `engagement_rate_30d` / `engagement_rate_90d` (or overrides from API). `profile.avg_engagement_rate` fallback. `engagement_rate_is_estimated`, `potential_reach_label`. |
| **KPI: Avg Likes/Post** | `rollup.avg_likes_7d` / `avg_likes_30d` / `avg_likes_90d`. `baseline.avg_likes_30d`. |
| **KPI: Avg Replies/Post** | `rollup.avg_replies_7d` / `avg_replies_30d` / `avg_replies_90d`. `baseline.avg_replies_30d`. |
| **KPI: Posts (7D/30D/90D)** | `rollup.posts_7d` / `posts_30d` / `posts_90d`. `baseline.posts_30d`. |
| **KPI: Potential Reach** | `rollup.reach_proxy_7d` / `reach_proxy_30d` / `reach_proxy_90d`. `potential_reach_label`, `potential_reach_is_estimated`. |
| **Top Drivers table** | `topDrivers`. `profile.followers_total` for engagement %. |
| **Freshness badge** | `tweets_last_synced_at`, `follower_last_synced_at`. |
| **Init / backfill / empty states** | From `GET /api/analytics/init-status` and `GET /api/analytics/x/summary` (not from `/api/analytics/x` payload). |

All of the above (except init/summary) are served by **one** request: `GET /api/analytics/x?window=7d|30d|90d`.

---

## 2) Authoritative data sources — charts and KPIs

**Charts (authoritative sources only):**

- **Follower Growth** → from **x_daily_snapshots** only. One row per (owner_type, owner_id, day). Follower deltas computed at request time as today_followers − yesterday_followers. No other table.
- **Engagement Rate** → from **x_tweets** only. Grouped by day; daily engagement_pct = (likes+replies+reposts+quotes) / impressions; 0 if no impressions. No rollup table.
- **Posting Cadence** → from **x_tweets** only. Count of tweets per day in window; zero-filled. No rollup table.

**KPIs (decided approach):**

- **Single approach:** KPIs are computed at request time from **x_tweets** and **x_daily_snapshots** (and profile/baseline for current followers and “since joining”). Optionally one rollup table (**x_window_aggregates**) can be used when present for 7/30/90 window sums and counts to avoid heavy aggregation; the API contract keeps the same shape either way.
- **Documented choice:** API uses **x_window_aggregates** when available for posts_*, avg_likes_*, avg_replies_*, engagement_rate_*, reach_proxy_* (one rollup table). When x_window_aggregates is missing, the API computes the same metrics from **x_tweets** so the response shape is stable. **KPI fallback correctness (from x_tweets):** avg_likes_* = sum(like_count)/tweet_count, avg_replies_* = sum(reply_count)/tweet_count; do not use total_engagement for "avg likes". Chart math (engagement rate, cadence) is unchanged. No use of analytics_snapshots or x_analytics_rollups for chart or primary KPI logic.

**DB tables used for analytics:**

| Table | Used for | Authoritative for |
|-------|----------|--------------------|
| **x_tweets** | Engagement chart, Posting cadence chart, tweet counts, engagement/reach metrics | Charts: engagement + cadence. KPIs: when no x_window_aggregates. |
| **x_daily_snapshots** | Follower growth chart, follower counts/deltas, snapshot_max_day | Charts: follower growth. Freshness: snapshot date. |
| **x_window_aggregates** | 7/30/90 window sums and counts (posts, avg likes/replies, engagement rate, reach) | KPIs when present (single rollup source). |
| **profiles** | followers_total, x_last_profile_sync_at, x_last_tweets_sync_at, twitter_username | Current follower count and sync timestamps. |
| **profile_analytics_baseline** | “Since joining” deltas | Baseline values only. |
| **x_top_drivers** | Top drivers table | Top drivers only. |
| **analytics_snapshots** | Not used by /api/analytics/x | Legacy; do not use for charts or KPIs. |
| **x_analytics_rollups** | Not used by /api/analytics/x | Legacy; do not use for charts or KPIs. |

---

## 2b) API endpoints involved (Analytics UI)

Every endpoint the Analytics UI calls:

| Endpoint | Method | Params / headers | Purpose |
|----------|--------|------------------|---------|
| **/api/analytics/x** | GET | Query: `window=7d\|30d\|90d`, optional `debug=1`. Header: `Authorization: Bearer <token>`. | Main payload: charts, KPIs, rollup, snapshots, freshness. |
| **/api/analytics/init-status** | GET | Header: `Authorization: Bearer <token>`. | Initialized state, 90d aggregate, snapshot count, backfill job status. |
| **/api/analytics/x/summary** | GET | Header: `Authorization: Bearer <token>`. | 7D/30D/90D window aggregates from x_window_aggregates; backfilling state; snapshot day count. |
| **/api/analytics/x/rebuild** | POST | Header: `Authorization: Bearer <token>`. | Enqueue **x_backfill_90d** for current user (idempotent). Does not run the job; Railway worker drains the queue. |
| **/api/analytics/x/job** | GET | Header: `Authorization: Bearer <token>`. | Latest x_backfill_90d job for current user (poll for status after rebuild). |
| **/api/analytics/backfill-90** | POST | Header: `Authorization: Bearer <token>`. | Enqueue x_backfill_90d for current user when not yet initialized (rate-limited). Used by “Start backfill” / empty state. |
| **/api/analytics/ensure-backfill** | GET or POST | Header: `Authorization: Bearer <token>`. Optional POST body: `{ profile_id }` or `{ username }`. | Ensures today’s snapshot is written (upsert x_daily_snapshots) and enqueues x_backfill_90d if no 90d data. Called on login / first load. |
| **/api/profile/refresh-x-insights** | POST | Header: `Authorization: Bearer <token>`. | Refreshes X “insights” cache (top followers, mentions, account feed). Writes: **x_top_followers_cache**, **x_account_feed_cache**, **x_mentions_weekly_cache**, **x_insights_refresh_state**. Does **not** write x_tweets or x_daily_snapshots. Used by “Refresh insights” in some dashboards. |

**Rebuild / refresh (what they trigger):**

- **“Refresh data” (Analytics page):** Calls **POST /api/analytics/x/rebuild** → inserts one row into **analytics_jobs** (job_type = `x_backfill_90d`). Railway worker (queue drainer) picks it up and runs the backfill (ingestXTweets, snapshots, x_window_aggregates, etc.). UI then polls **GET /api/analytics/x/job** and refetches **/api/analytics/x** when job completes.
- **“Refresh insights” (Insights tab / Profile dashboard):** Calls **POST /api/profile/refresh-x-insights** → **refreshXInsightsForProfile** → writes cache tables only (no x_tweets, no x_daily_snapshots).
- **“Refresh now” (public one-pager):** Calls **GET/POST /api/analytics/ensure-backfill** → writes today’s **x_daily_snapshots** row and enqueues **x_backfill_90d** if needed.

**“Refresh data” button flow (exact):**

1. User clicks “Refresh data” (or “Rebuild analytics”).
2. Frontend: **POST /api/analytics/x/rebuild** with `Authorization: Bearer <token>`.
3. Backend: Validates token; if no existing queued/running x_backfill_90d for this profile, inserts into **analytics_jobs** (owner_type=profile, owner_id=user.id, job_type=x_backfill_90d, status=queued). Returns `{ job: { id, status, run_after, ... }, existing: true|false }`.
4. Frontend: Polls **GET /api/analytics/x/job** every 5s until status is `done` or `failed`; optionally refetches /api/analytics/x and /api/analytics/x/summary when done.
5. **Who runs the job:** Railway worker (run:jobs / queue drainer) processes analytics_jobs and executes the backfill (writes **x_tweets**, **x_daily_snapshots**, **x_window_aggregates**, **profiles.analytics_initialized_at**, etc.). Vercel does not run the job.

---

## 3) All jobs that write data

### Tweet ingestion job

| Field | Value |
|-------|--------|
| **Script name** | `apps/worker/src/sync_x_tweets_weekly.ts` (Railway cron name e.g. `sync:x:tweets:daily`). Vercel: `POST /api/cron/sync-x-tweets-weekly`. |
| **Schedule** | Railway only: every 6h recommended (e.g. `0 */6 * * *`). Vercel route: manual/admin only, not scheduled. |
| **Filter query** | Profiles with `twitter_username` not null; batch limit (see script). |
| **Writes** | **x_tweets** (via ingestXTweets). Then **x_analytics_rollups** and **x_top_drivers** (refreshXRollupsForProfile). Updates **profiles.x_last_tweets_sync_at**. |

### Snapshot job (follower / profile snapshot)

| Field | Value |
|-------|--------|
| **Script name** | Worker: `apps/worker/src/sync_x_profiles_daily.ts` (Railway: `sync:x:profiles:daily`). Vercel: `POST /api/cron/sync-x-profiles-daily`. |
| **Schedule** | **Must run DAILY.** Railway only: e.g. `0 8 * * *`. Vercel route: manual/admin only, **not scheduled**. |
| **Filter query** | Worker: `profiles` where `is_indexed = true`, `twitter_username` not null, and (`x_last_profile_sync_at` null or &lt; 24h). Priority profile IDs (env) prepended; limit 500. Vercel: same base + limit 500 + priority header; no 24h throttle (see § Snapshot selection logic). |
| **Writes** | **profiles** (followers_total, x_last_profile_sync_at, etc.). **x_daily_snapshots** (one row per profile for **today** only). **profile_analytics_baseline** (first insert only). Upsert key: (owner_type, owner_id, day) — idempotent. |

### Backfill job

| Field | Value |
|-------|--------|
| **Who enqueues** | ensure-backfill (on login/first load), backfill-90 (user retry), rebuild (user-triggered). All insert into **analytics_jobs** (job_type = `x_backfill_90d`). |
| **Who drains** | Railway: queue drainer (`run:jobs`) every 2–5 min. Processes analytics_jobs. |
| **What it fills** | **x_tweets** (ingestXTweets, up to 1000). **x_daily_snapshots** (90 days; followers only for today, rest from tweet aggregates). **x_window_aggregates** (7/30/90). **profiles.analytics_initialized_at**. |

### Single scheduling authority

**Railway worker cron is the only scheduled job** for daily snapshots and tweet sync. Do not schedule Vercel cron routes for these.

- **Daily snapshots:** Schedule only on Railway (e.g. `sync:x:profiles:daily` at `0 8 * * *`). **Do not** add `/api/cron/sync-x-profiles-daily` to Vercel Cron. The Vercel route exists for **manual/admin triggers only** (e.g. with CRON_SECRET and optional X-Priority-Profile-Ids).
- **Tweet sync:** Schedule only on Railway (e.g. sync:x:tweets every 6h). **Do not** schedule `/api/cron/sync-x-tweets-weekly` (or equivalent) on Vercel unless it is explicitly a manual trigger.

**Confirmation:** Railway is the scheduler for X analytics ingestion (snapshots + tweets). Vercel cron routes for X are not scheduled; they are for on-demand or admin use only.

### Snapshot selection logic (worker vs manual route)

| | Railway worker (`sync_x_profiles_daily.ts`) | Vercel manual (`POST /api/cron/sync-x-profiles-daily`) |
|--|---------------------------------------------|--------------------------------------------------------|
| **Filter** | `is_indexed = true`, `twitter_username` not null, and (`x_last_profile_sync_at` is null or &lt; 24h). Limit 500. Priority profile IDs (env) prepended. | Same base: `is_indexed = true`, `twitter_username` not null. Limit 500. Priority profile IDs from header `X-Priority-Profile-Ids` prepended. |
| **24h throttle** | **Yes.** Only profiles not synced in the last 24h (or never) are selected. | **No.** Does not filter by `x_last_profile_sync_at`, so an admin can force re-sync the same profile the same day. |
| **Why differ** | Prevents over-calling the X API when running daily; each profile at most once per day. | Manual/admin run may need to re-sync a specific profile (e.g. after fix or for priority user). |

To align behavior: if the manual route should also respect 24h throttle, add the same `.or(\`x_last_profile_sync_at.is.null,x_last_profile_sync_at.lt.${past24}\`)` to the Vercel route. Currently they differ by design (scheduled = throttle, manual = no throttle).

---

## 4) Freshness standards

| Signal | Rule |
|--------|------|
| **Tweets** | Considered fresh if **synced in the last 6 hours** (profiles.x_last_tweets_sync_at). |
| **Follower snapshots** | Considered fresh if **a snapshot exists for today or yesterday** (x_daily_snapshots.day >= yesterday). |

---

## 5) SQL to verify data for a given profile (prove the bottleneck)

Replace `'PROFILE_ID'` with the profile UUID (e.g. from `auth.uid()` or `profiles.id`).

```sql
-- Count follower snapshots in last 30 days
SELECT COUNT(*) AS snapshot_count_30d
FROM x_daily_snapshots
WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID'
  AND day >= (CURRENT_DATE - INTERVAL '29 days');

-- List last 15 snapshot days (newest first)
SELECT day
FROM x_daily_snapshots
WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID'
ORDER BY day DESC
LIMIT 15;

-- Count tweets in last 7 / 30 / 90 days
SELECT
  COUNT(*) FILTER (WHERE tweeted_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days'))  AS tweets_7d,
  COUNT(*) FILTER (WHERE tweeted_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')) AS tweets_30d,
  COUNT(*) FILTER (WHERE tweeted_at >= (CURRENT_TIMESTAMP - INTERVAL '90 days')) AS tweets_90d
FROM x_tweets
WHERE profile_id = 'PROFILE_ID';

-- Last tweet timestamp
SELECT MAX(tweeted_at) AS last_tweet_at
FROM x_tweets
WHERE profile_id = 'PROFILE_ID';
```

**How to interpret:** If `snapshot_count_30d` is low (e.g. 6) while the user expects daily data, the bottleneck is **follower snapshots not being written daily** (snapshot job not running daily, or profile not included in the batch). Tweet counts and `last_tweet_at` confirm tweet ingestion is working.

---

## 6) Root cause summary (why follower coverage is low)

**Confirmed by the SQL above:**

- **Follower coverage (e.g. 6/30 or 6/90)** is low because there are only a few rows in **x_daily_snapshots** for that profile in the window.
- **Causes:**
  1. **Snapshot job not running daily** — If the daily profile snapshot cron is not scheduled or not running every day, no new snapshot row is written for “today” for that profile.
  2. **Profile not in the batch** — The snapshot job selects profiles with `is_indexed = true` and `twitter_username` not null, with a **limit** (e.g. 100). If there are more than 100 eligible profiles, this profile may not be in the first 100 on a given run, so it gets skipped that day.
  3. **Throttle (worker only)** — The worker only includes profiles where `x_last_profile_sync_at` is null or older than 24h. So each profile is at most once per day; if the list is long and limit is 100, some profiles never get into the 100.

**Fix (implemented in code):** Run the snapshot job **daily** on Railway; **always include** the current user (or priority profile IDs) in the batch; **raise or remove** the limit (e.g. 500); keep upsert idempotent on (owner_type, owner_id, day); add **logging** (number selected, first 10 ids, whether priority user included, number of snapshots upserted).

---

## 7) API response contract (stable)

- **Charts:** Always from **x_tweets** and **x_daily_snapshots** only. Same field names and shapes.
- **KPIs:** Same response shape; source is either **x_window_aggregates** (one rollup) or computed from **x_tweets** + **x_daily_snapshots** when that rollup is missing. Legacy fallbacks (analytics_snapshots, x_analytics_rollups) are not used for chart logic and are only used where explicitly required for backward compatibility.
- **Freshness:** `tweets_last_synced_at`, `follower_last_synced_at`; freshness rules: tweets fresh if synced in last 6h, follower snapshots fresh if snapshot exists for today or yesterday.
