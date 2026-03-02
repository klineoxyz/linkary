# X Analytics Data Flow Map + DB Source of Truth + UI Contract

Single source of truth for the `/analytics` page: what it renders, where data comes from, and how to keep it correct.

---

## 1) What the Analytics page renders today

Every chart and KPI on `/analytics` (X platform), and which API/fields they use.

| UI element | API endpoint | Response fields used |
|------------|--------------|----------------------|
| **Follower Growth chart** | `GET /api/analytics/x?window=7d\|30d\|90d` | `chart_points.follower_growth` (array of `{ date, follower_delta }`). Coverage: `follower_data_coverage_days`, `follower_window_days`, `follower_earliest_snapshot_date`. |
| **Engagement Rate chart** | Same | `chart_points.engagement_rate` (array of `{ date, engagement_pct, posts }`). Coverage: `engagement_data_coverage_days`, `window_days`. Low-activity: `tweet_count_window`, `engagement_rate_pct`. |
| **Posting Cadence chart** | Same | `chart_points.posting_cadence` (array of `{ date, posts }`). `tweet_count_window` for “Posts in window”. |
| **KPI: Followers** | Same | `profile.followers_total`. Deltas: from `snapshots` (x_daily_snapshots) or `window_summary.windows` (x_window_aggregates). Baseline: `baseline.followers_total`. |
| **KPI: Engagement Rate** | Same | `rollup.engagement_rate_7d/30d/90d` (overridden at request time from x_tweets → `window_metrics`). Fallback: `profile.avg_engagement_rate`. `engagement_rate_is_estimated`, `potential_reach_label`. |
| **KPI: Avg Likes/Post** | Same | `rollup.avg_likes_7d/30d/90d`. Baseline: `baseline.avg_likes_30d`. |
| **KPI: Avg Replies/Post** | Same | `rollup.avg_replies_7d/30d/90d`. Baseline: `baseline.avg_replies_30d`. |
| **KPI: Posts (7D/30D/90D)** | Same | `rollup.posts_7d/30d/90d`. Baseline: `baseline.posts_30d`. |
| **KPI: Potential Reach** | Same | `rollup.reach_proxy_7d/30d/90d` (overridden from x_tweets when available). `potential_reach_label`, `potential_reach_is_estimated`. |
| **Top Drivers table** | Same | `topDrivers` (from `x_top_drivers`). `profile.followers_total` for engagement %. |
| **Init / backfill state** | `GET /api/analytics/init-status` | `initialized`, `has90dAggregate`, `snapshotDays`, `job`, `hasTodaySnapshot`. |
| **Window summary (7/30/90)** | `GET /api/analytics/x/summary` | `windows["7"\|"30"\|"90"]`, `is_backfilling`, `snapshot_days_count`, `source`. |
| **Freshness badge** | From `/api/analytics/x` | `tweets_last_synced_at`, `follower_last_synced_at` (max of the two → “Data last synced: X”). |
| **“Refresh data” / Rebuild** | `POST /api/analytics/x/rebuild` | Enqueues `x_backfill_90d`; UI polls `GET /api/analytics/x/job`. |
| **Retry backfill** | `POST /api/analytics/backfill-90` | Enqueues `x_backfill_90d` when not initialized (rate-limited). |
| **Initial sync (no baseline)** | `POST /api/x-sync` | One-off trigger to sync profile + today snapshot. |

All primary chart and KPI data for the selected window comes from **one** call: `GET /api/analytics/x?window=7d|30d|90d`. The page uses `init-status` and `x/summary` for loading/empty states and window aggregates metadata.

---

## 2) API endpoints involved (source of truth)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/analytics/x` | GET | Main payload: profile, rollup, topDrivers, baseline, snapshots, chart_points, data_status, window_metrics, coverage fields, freshness. Query: `?window=7d|30d|90d`, `?debug=1`. |
| `/api/analytics/init-status` | GET | Whether analytics is initialized, 90d aggregate exists, snapshot count, backfill job status. |
| `/api/analytics/x/summary` | GET | 7/30/90 window aggregates from x_window_aggregates; is_backfilling; snapshot_days_count. |
| `/api/analytics/x/rebuild` | POST | Enqueue `x_backfill_90d` (idempotent). Returns job id/status. |
| `/api/analytics/x/job` | GET | Latest `x_backfill_90d` job for current user. |
| `/api/analytics/backfill-90` | POST | Enqueue `x_backfill_90d` when not initialized (rate-limited 3/30min). |
| `/api/analytics/ensure-backfill` | GET/POST | Write today’s row to x_daily_snapshots; enqueue backfill if no 90d data and no recent job. Called on login / first load. |
| `/api/x-sync` | POST | Sync profile (followers, etc.) and write today’s snapshot; used when user has X but no baseline. |

### Full response shape: `GET /api/analytics/x`

**Query:** `?window=7d|30d|90d` (default 30d). `?debug=1` adds `debug` object.

**Top-level fields:**

- **Window:** `window_start`, `window_end`, `window_days`
- **Profile:** `profile` (followers_total, avg_engagement_rate, x_last_profile_sync_at, x_last_tweets_sync_at, twitter_username, analytics_initialized_at, …)
- **Rollup (KPIs):** `rollup` — posts_7d/30d/90d, avg_likes_*, avg_replies_*, engagement_rate_7d/30d/90d, reach_proxy_7d/30d/90d. Sourced from x_window_aggregates when present, else x_analytics_rollups; engagement_rate and reach_proxy are overridden from x_tweets at request time.
- **Charts:** `chart_points.follower_growth`, `chart_points.engagement_rate`, `chart_points.posting_cadence`
- **Freshness:** `tweets_last_synced_at`, `follower_last_synced_at`, `data_freshness_at`, `follower_data_stale`
- **Coverage:** `tweet_count_window`, `follower_data_coverage_days`, `follower_earliest_snapshot_date`, `follower_window_days`, `engagement_data_coverage_days`
- **Current window metrics:** `engagement_rate_pct`, `engagement_rate_is_estimated`, `posting_cadence`, `potential_reach_value`, `potential_reach_label`, `potential_reach_is_estimated`, `tweet_count`
- **Other:** `topDrivers`, `baseline`, `snapshots`, `source`, `data_status`, `diagnostics`, `window_metrics` (7/30/90), `freshness` (snapshot_max_day, aggregate_max_as_of)

**chart_points:**

- `follower_growth`: `Array<{ date: string, follower_delta: number | null }>` — only dates from effectiveFollowerWindowStart..windowEnd (no fabricated history). Null = no snapshot for that day.
- `engagement_rate`: `Array<{ date: string, engagement_pct: number, posts: number }>` — one entry per day in window; engagement_pct = daily engagement / daily impressions, 0 if no impressions.
- `posting_cadence`: `Array<{ date: string, posts: number }>` — one entry per day in window; zero-filled.

**data_status:** `tweet_count_7d`, `tweet_count_30d`, `tweet_count_90d`, `last_tweet_at`, `rollup_updated_at`

**When `?debug=1`**, `payload.debug` also includes:

- `snapshot_rows_count_in_window`, `distinct_snapshot_dates_in_window`, `min_snapshot_date`, `max_snapshot_date`
- `chart_points_count`, `tweet_count_window`, `total_engagement_window`, `total_impressions_window`, etc.

---

## 3) Where each metric is computed

| Metric | Computed from | Notes |
|--------|----------------|-------|
| **Follower growth (chart)** | x_daily_snapshots | At request time: per-day `follower_delta = today_followers - yesterday_followers`. Chart limited to [effectiveFollowerWindowStart, today]; effectiveStart = max(windowStart, earliestSnapshotDate). No interpolation. |
| **Engagement rate (chart)** | x_tweets | At request time: grouped by day; daily `engagement_pct = (likes+replies+reposts+quotes) / impressions * 100`; 0 if impressions=0. Full window 7/30/90 points. |
| **Posting cadence (chart)** | x_tweets | At request time: count of tweets per day in window; zero-filled for all days. |
| **Engagement rate (KPI)** | x_tweets (primary) | At request time: `window_metrics` from x_tweets for 7/30/90; overrides rollup. engagement_rate_pct = total_engagement / total_impressions (or fallback when no impressions). |
| **Reach / impressions (KPI)** | x_tweets (primary) | At request time: from same window_metrics; potential_reach_value = sum(impressions) or followers×posts estimate. |
| **Posts, avg likes, avg replies (KPI)** | x_window_aggregates or x_analytics_rollups | From DB: x_window_aggregates preferred (worker backfill); else x_analytics_rollups (worker refresh). Not recomputed from raw tweets in the API. |
| **Followers (current)** | profiles | `profile.followers_total`; also `x_last_profile_sync_at`. |
| **Follower deltas (KPI %)** | snapshots or x_window_aggregates | From `snapshots` (x_daily_snapshots) for sparkline/deltas, or from `window_summary.windows` (x_window_aggregates) when available. |
| **Top drivers** | x_top_drivers | Precomputed by worker (refreshXRollups); window_days=30. |
| **Baseline (“since joining”)** | profile_analytics_baseline | One row per (profile, platform); set on first sync / backfill. |

**Summary:** Charts use **x_tweets** (engagement, cadence) and **x_daily_snapshots** (follower growth), computed at request time. KPIs use **x_window_aggregates** (or x_analytics_rollups) for counts/averages, with engagement and reach overridden from **x_tweets** at request time.

---

## 4) Database tables used (exact)

| Table | Primary key | Important columns | Who writes | Row frequency |
|-------|-------------|-------------------|------------|----------------|
| **x_tweets** | id (uuid) | profile_id, tweet_id, tweeted_at, like_count, reply_count, repost_count, quote_count, impression_count | Worker: ingestXTweets (xBackfill90d, sync_x_tweets_weekly). Web: x-sync can trigger ingest. | Per tweet; one row per (profile_id, tweet_id). |
| **x_daily_snapshots** | id (uuid), UNIQUE(owner_type, owner_id, day) | owner_type, owner_id, day (date), followers, tweets_count, likes_received, engagement_rate | Worker: sync_x_profiles_daily (today); xBackfill90d (90 days). Web: ensure-backfill (today); x-sync (today); cron: sync-x-profiles-daily, x-analytics-daily (today). | One row per (profile, day). |
| **x_window_aggregates** | id (uuid), UNIQUE(owner_type, owner_id, window_days, as_of) | owner_type, owner_id, window_days (7\|30\|90), as_of, followers_start/end/delta, posts_count, avg_engagement_rate, avg_likes_per_post, etc. | Worker: xBackfill90d only (after filling x_daily_snapshots for 90 days). | One row per (profile, window_days, as_of); typically latest as_of per window. |
| **x_analytics_rollups** | profile_id | posts_7d/30d/90d, avg_likes_*, avg_replies_*, engagement_rate_*, reach_proxy_* | Worker: refreshXRollupsForProfile (from x_tweets); called by sync_x_tweets_weekly, rebuild_x_rollups. | One row per profile; updated when tweets sync/rebuild. |
| **x_top_drivers** | id (uuid), UNIQUE(profile_id, window_days, tweet_id) | profile_id, window_days, tweet_id, tweeted_at, like_count, reply_count, repost_count, engagement_score | Worker: refreshXRollupsForProfile (from x_tweets). | Up to 10 rows per (profile_id, window_days=30). |
| **profile_analytics_baseline** | (profile_id, platform) | baseline_at, baseline_date, followers_total, engagement_rate_proxy, posts_30d, avg_likes_30d, etc. | Worker: sync_x_profiles_daily (first insert). Web: ensure-backfill / x-sync can insert. | One row per (profile, platform). |
| **analytics_snapshots** | id, UNIQUE(profile_id, platform, snapshot_date) | profile_id, platform, snapshot_date, followers_total | Legacy; API still reads if x_daily_snapshots empty. | Legacy daily snapshots. |
| **analytics_jobs** | id (uuid) | job_type, owner_type, owner_id, status, run_after, attempts, last_error | Web: ensure-backfill, backfill-90, rebuild (insert). Worker: queue drainer (update status). | One row per enqueued job; job_type = `x_backfill_90d`. |
| **profiles** | id | twitter_username, is_indexed, x_last_profile_sync_at, x_last_tweets_sync_at, analytics_initialized_at, followers_total, avg_engagement_rate | Worker: sync_x_profiles_daily, xBackfill90d (analytics_initialized_at). Web/cron: profile syncs. | One row per user. |

**Relevant code paths:**

- `apps/web/src/app/api/analytics/x/route.ts` — reads profiles, x_analytics_rollups, x_top_drivers, profile_analytics_baseline, analytics_snapshots, x_daily_snapshots, x_window_aggregates, x_tweets.
- Worker: `apps/worker/src/jobs/xBackfill90d.ts` (x_tweets via ingestXTweets, x_daily_snapshots, x_window_aggregates); `apps/worker/src/sync_x_profiles_daily.ts` (profiles, x_daily_snapshots); `apps/worker/src/lib/refreshXRollups.ts` (x_analytics_rollups, x_top_drivers).

---

## 5) Ingestion pipeline and schedules (truth)

**Single scheduling authority:** Railway (see `apps/worker/railway.toml`). Vercel crons exist but Railway is the recommended place to run X analytics jobs.

### Tweet ingestion

| What | Script / route | Schedule | Who is included | Where stored |
|------|----------------|----------|-----------------|--------------|
| Worker tweet sync | `sync_x_tweets_weekly.ts` (e.g. `sync:x:tweets:daily`) | Recommended: every 6h (e.g. `0 */6 * * *`) | Profiles with twitter_username; batch limit. | x_tweets. Then refreshXRollupsForProfile → x_analytics_rollups, x_top_drivers. |
| Backfill 90d | xBackfill90d job (drained by queue drainer) | Drainer: every 2–5 min | One profile per job (enqueued by ensure-backfill, backfill-90, rebuild). | x_tweets (ingestXTweets), then x_daily_snapshots (90 days), x_window_aggregates (7/30/90). |
| Vercel cron | `sync-x-tweets-weekly` (POST /api/cron/sync-x-tweets-weekly) | If configured in Vercel | Same as worker; uses CRON_SECRET. | Same. |

### Profile / follower snapshot

| What | Script / route | Schedule | Who is included | Where stored | Throttle |
|------|----------------|----------|-----------------|--------------|----------|
| Worker profile sync | `sync_x_profiles_daily.ts` (e.g. `sync:x:profiles:daily`) | Recommended: daily (e.g. `0 8 * * *`) | is_indexed = true, twitter_username not null, (x_last_profile_sync_at null or &lt; 24h). Batch 100. | profiles (followers_total, x_last_profile_sync_at); x_daily_snapshots (today only). | 24h per profile. |
| Vercel cron | `sync-x-profiles-daily` (POST /api/cron/sync-x-profiles-daily) | If configured | is_indexed = true, twitter_username not null. Limit 100. | Same. | No 24h filter in cron; processes first 100. |
| ensure-backfill | GET/POST /api/analytics/ensure-backfill | On login / first load | Current user’s profile (with X connected). | x_daily_snapshots (today); analytics_jobs (enqueue backfill if no 90d). | Rate limit 20/10min. |
| x-analytics-daily | POST /api/cron/x-analytics-daily | If configured | Vercel cron. | x_daily_snapshots (today). | — |

### Backfill jobs

| Step | Who enqueues | Who drains | What gets populated |
|------|--------------|------------|----------------------|
| x_backfill_90d | ensure-backfill (when no 90d, no recent job), backfill-90 (when not initialized), rebuild (user-triggered) | Railway: `run:jobs` (queue drainer) every 2–5 min | x_tweets (up to 1000), x_daily_snapshots (90 days), x_window_aggregates (7/30/90), profiles.analytics_initialized_at |

**Important:** Follower growth chart needs **daily** rows in x_daily_snapshots. Those come from:

1. **xBackfill90d** — writes 90 days of x_daily_snapshots in one go (followers only for today; other days get tweets_count/likes/etc.).
2. **sync_x_profiles_daily** (or sync-x-profiles-daily cron) — writes **today’s** snapshot (followers, engagement_rate) for profiles in batch (is_indexed + twitter_username, limit 100).

If only backfill ran and no daily cron runs, you get at most one “today” update per run and no new days. So for 30/90 “full” coverage you need the **daily profile snapshot** job running every day and including this profile (is_indexed, in batch).

---

## 6) Freshness standards (launch rules)

| Signal | Source | Stale threshold | UI behavior |
|--------|--------|------------------|-------------|
| tweets_last_synced_at | profiles.x_last_tweets_sync_at | &gt; 6h consider stale | Show in “Data last synced”; amber dot &gt; 24h, red &gt; 48h. |
| follower_last_synced_at | profiles.x_last_profile_sync_at | &gt; 24h consider stale | Same; follower_data_stale when snapshot_max_day &lt; yesterday. |
| Snapshot coverage | follower_data_coverage_days / follower_window_days | &lt; 10 days in 30d window → “still building” | Show empty state: “Follower history is still building…” + Refresh data. |
| Engagement coverage | engagement_data_coverage_days ≤ 2 with tweets &gt; 0 | Low activity | Show summary card instead of chart (Active days, Posts, Engagement rate). |
| Cadence | tweet_count_window ≤ 2 | Low activity | Show summary (Posts in window, Cadence posts/day) instead of chart. |

**“Refresh data” button:** Calls `POST /api/analytics/x/rebuild` (enqueues x_backfill_90d). Does not run profile snapshot cron; backfill only refetches tweets and rewrites 90 days of x_daily_snapshots (today’s followers from current API call; other days from tweet aggregates). So “Refresh data” does not fix “no daily snapshot” — that requires the **daily profile snapshot** job to run and include the profile.

---

## 7) Root cause checklist for low follower snapshot coverage

Example: **Coverage: 6/30 or 6/90** — chart shows “Follower history is still building” or only 6 bars.

**Checklist:**

1. **Confirm how many snapshot rows exist in the window (API debug)**  
   Call `GET /api/analytics/x?window=30d&debug=1`. In `debug`:  
   - `snapshot_rows_count_in_window` — number of x_daily_snapshots rows in [window_start, window_end].  
   - `distinct_snapshot_dates_in_window`, `min_snapshot_date`, `max_snapshot_date`.  
   If these show only 6 rows/dates, the DB has only 6 days of snapshots for that profile in that window.

2. **SQL: snapshot counts for the profile**  
   Replace `PROFILE_ID` with the user’s profile UUID (auth.uid() or from profiles table).

   ```sql
   -- Count snapshots in last 30 days
   SELECT COUNT(*) AS snapshot_count_30d
   FROM x_daily_snapshots
   WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID'
     AND day >= (CURRENT_DATE - INTERVAL '29 days');

   -- List latest snapshot dates (last 90)
   SELECT day
   FROM x_daily_snapshots
   WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID'
   ORDER BY day DESC
   LIMIT 90;

   -- Min/max snapshot dates
   SELECT MIN(day) AS min_day, MAX(day) AS max_day
   FROM x_daily_snapshots
   WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID';
   ```

3. **Profile eligibility for daily snapshot**  
   - `profiles.is_indexed = true`  
   - `profiles.twitter_username` not null  
   - For worker: `x_last_profile_sync_at` is null or &gt; 24h ago (so profile is in the batch)  
   - Batch limit: worker and Vercel cron both use a limit (e.g. 100). If &gt; 100 eligible profiles, this profile might not be in the first 100 every day.

4. **Railway cron**  
   - Confirm `sync:x:profiles:daily` (or equivalent) is scheduled daily.  
   - Check worker logs for “sync_x_profiles_daily” or “sync-x-profiles-daily” and that the profile’s id (or handle) appears.

5. **Manual run for one handle**  
   - Run the worker script with the handle (if supported), or trigger the Vercel cron with CRON_SECRET (sync-x-profiles-daily) and confirm the profile is in the batch.  
   - Or call ensure-backfill while logged in as that user: writes **today’s** snapshot only; does not backfill past days. Past days only come from xBackfill90d (which fills 90 days of snapshots from tweet data; followers only for today) or from repeated daily snapshot runs.

**Typical root cause:** Daily snapshot job not running, or profile not in the batch (is_indexed, limit, or 24h throttle), so only a few snapshot days exist (e.g. from backfill “today” + a few cron runs).

---

## 8) Final UI contract

**What the UI can assume is always present (when the user has X connected):**

- `GET /api/analytics/x?window=...` returns `window_start`, `window_end`, `window_days`, `chart_points` with three arrays. Follower array may be shorter than window_days (effective window). Engagement and posting_cadence arrays length = window_days.
- `tweets_last_synced_at`, `follower_last_synced_at` may be null; treat as “not synced”.
- `tweet_count_window`, `follower_data_coverage_days`, `follower_window_days`, `engagement_data_coverage_days`, `follower_earliest_snapshot_date` are present (numbers or null).

**Optional / may be null:**

- `rollup` — null if no x_window_aggregates and no x_analytics_rollups. KPIs can fall back to profile or show “—”.
- `baseline` — null until first sync/baseline insert.
- `topDrivers` — can be empty.
- `snapshots` — from x_daily_snapshots (or legacy analytics_snapshots). Can be empty.

**Sparse data (launch-clean rules):**

- **Follower:** If `follower_window_days >= 30` and `follower_data_coverage_days < 10`: show empty state “Follower history is still building…” with coverage and earliest date; do not show a thin chart.
- **Engagement:** If `tweet_count_window === 0`: empty state. If `tweet_count_window > 0` and `engagement_data_coverage_days <= 2`: show summary card (Active days, Posts, Engagement rate); do not show a single-bar chart.
- **Posting cadence:** If `tweet_count_window <= 2`: show summary (Posts in window, Cadence posts/day); do not show a nearly empty chart.
- **Null follower_delta:** In the follower chart, render a gap (no bar); tooltip “No snapshot”.

**Tables that must be populated for charts to look “full”:**

- **Follower growth:** x_daily_snapshots with one row per day in the effective window (so daily snapshot job must run and include this profile).
- **Engagement / cadence:** x_tweets with tweets in the window (tweet ingestion + backfill).

---

## Bonus: SQL snippets for a given profile

Replace `'PROFILE_ID'` with the profile UUID.

```sql
-- Count snapshots in last 30 days
SELECT COUNT(*) AS snapshot_count_30d
FROM x_daily_snapshots
WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID'
  AND day >= (CURRENT_DATE - INTERVAL '29 days');

-- List latest snapshot dates
SELECT day
FROM x_daily_snapshots
WHERE owner_type = 'profile' AND owner_id = 'PROFILE_ID'
ORDER BY day DESC
LIMIT 90;

-- Count tweets in last 7 / 30 / 90 days
SELECT
  COUNT(*) FILTER (WHERE tweeted_at >= (CURRENT_TIMESTAMP - INTERVAL '7 days'))  AS tweets_7d,
  COUNT(*) FILTER (WHERE tweeted_at >= (CURRENT_TIMESTAMP - INTERVAL '30 days')) AS tweets_30d,
  COUNT(*) FILTER (WHERE tweeted_at >= (CURRENT_TIMESTAMP - INTERVAL '90 days')) AS tweets_90d
FROM x_tweets
WHERE profile_id = 'PROFILE_ID';

-- Latest tweet date
SELECT MAX(tweeted_at) AS latest_tweet_at
FROM x_tweets
WHERE profile_id = 'PROFILE_ID';
```

---

## Summary: Likely bottleneck for low follower coverage

- **Tweets:** Usually fine (engagement/cadence populated from x_tweets and backfill).
- **Follower snapshots:** Often low (e.g. 6/30) because:
  1. **Daily snapshot job** (sync_x_profiles_daily or sync-x-profiles-daily) is not running daily, or  
  2. **Profile not in batch** (is_indexed, twitter_username, or limit 100), or  
  3. Only **ensure-backfill** and **backfill** ran (backfill writes 90 days of x_daily_snapshots but only **today** has followers from API; other days get tweets_count/likes from backfill. So “followers” in chart need either today’s row from daily job or backfill’s today. For historical follower deltas you need **consecutive days** of snapshot rows, which only the **daily** snapshot job provides over time).

So: fix daily profile snapshot schedule and batch inclusion first; then use this doc as the single source of truth for the analytics UI contract and DB sources.
