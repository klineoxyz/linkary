# Railway worker services audit

Factual summary of what each Railway worker service runs, which scripts/entrypoints they use, and what the code does. No recommendations—audit only.

---

## A) Scripts and entrypoints

### Root `package.json` (monorepo)

- No worker cron scripts. Worker scripts live only in `apps/worker/package.json`.

### `apps/worker/package.json` scripts

| Script | Command | dist/ file | Source file |
|--------|---------|------------|-------------|
| `sync:x:profiles:daily` | `node dist/sync_x_profiles_daily.js` | `sync_x_profiles_daily.js` | `src/sync_x_profiles_daily.ts` |
| `sync:x:daily` | `node dist/sync_x_profiles_daily.js` | (same) | (same) |
| `sync:x:tweets:weekly` | `node dist/sync_x_tweets_weekly.js` | `sync_x_tweets_weekly.js` | `src/sync_x_tweets_weekly.ts` |
| `sync:x:weekly` | `node dist/sync_x_tweets_weekly.js` | (same) | (same) |
| `run:jobs` | `node dist/run_analytics_jobs.js` | `run_analytics_jobs.js` | `src/run_analytics_jobs.ts` |
| `debug:x:tweets` | `node dist/debug_x_tweets.js` | `debug_x_tweets.js` | `src/debug_x_tweets.ts` |
| `debug:ingest:x:tweets` | `node dist/debug_ingest_x_tweets.js` | `debug_ingest_x_tweets.js` | `src/debug_ingest_x_tweets.ts` |

**Railway service → script mapping (from docs/OPS_RUNBOOK_V1.md and railway.toml):**

- **Daily worker** → `pnpm run sync:x:profiles:daily` or `sync:x:daily` → `node dist/sync_x_profiles_daily.js`
- **Weekly worker** → `pnpm run sync:x:tweets:weekly` or `sync:x:weekly` → `node dist/sync_x_tweets_weekly.js`
- **Queue drainer** → `pnpm run run:jobs` → `node dist/run_analytics_jobs.js`

---

## B) What each entrypoint does

### 1. Daily worker: `node dist/sync_x_profiles_daily.js`

**Source:** `apps/worker/src/sync_x_profiles_daily.ts`

**Call chain:**  
`main()` → `getSupabaseAdmin()` → query `profiles` → for each profile `getUserInfo(handle)` → update `profiles` + upsert `x_daily_snapshots` + insert `profile_analytics_baseline` (ignore duplicate).

**Reads:**

- **profiles** (Supabase): `id`, `twitter_username` for eligible rows.

**Writes:**

- **profiles**: `followers_total`, `display_name`, `bio`, `avatar_url`, `avg_engagement_rate`, `updated_at`, `x_last_profile_sync_at`, `x_sync_status`, `x_sync_error`.
- **x_daily_snapshots**: upsert one row per profile per day (`owner_type`, `owner_id`, `day`, `followers`, `engagement_rate`, `raw`).
- **profile_analytics_baseline**: insert once per profile (`profile_id`, `platform`, `followers_total`, `engagement_rate_proxy`); duplicate key ignored.

**External APIs:**

- **twitterapi.io**: `GET /twitter/user/info?userName=...` (X-API-Key). Used for follower count, display name, bio, avatar, statusesCount, favouritesCount.

**Eligibility (selection):**

- `is_indexed = true`, `twitter_username` not null, `twitter_connected_at` not null, and (`x_last_profile_sync_at` is null or &lt; 24h ago).

**Frequency:** Intended daily (e.g. once per day via Railway Cron).

**Logs:**  
`Daily sync done. processed=N ok=N errors=N skipped=N`

---

### 2. Weekly worker: `node dist/sync_x_tweets_weekly.js`

**Source:** `apps/worker/src/sync_x_tweets_weekly.ts`

**Call chain:**  
`main()` → `getSupabaseAdmin()` → two queries on `profiles` (null sync at / stale sync at) → merge by id → for each profile `ingestXTweets()` → update `profiles` (`x_last_tweets_sync_at`, `x_sync_status`, `x_sync_error`) → on success and if upserted &gt; 0, `refreshXRollupsForProfile()`.

**Reads:**

- **profiles** (Supabase): `id`, `twitter_username` for eligible rows (sanity counts also read from `profiles`).

**Writes:**

- **profiles**: `x_last_tweets_sync_at`, `x_sync_status`, `x_sync_error`, `updated_at` (after ingest success or failure).
- **x_tweets**: via `ingestXTweets` (upsert on `profile_id`, `tweet_id`).
- **x_analytics_rollups**: via `refreshXRollupsForProfile` (upsert per profile).
- **x_top_drivers**: via `refreshXRollupsForProfile` (delete then upsert for that profile/window).

**External APIs:**

- **twitterapi.io**: `GET /twitter/user/last_tweets?userName=...` (X-API-Key). Used inside `ingestXTweets` → `getRecentTweets()`.

**Eligibility (selection):**

- `twitter_username` not null and non-empty, `twitter_connected_at` not null.
- Incremental: `x_last_tweets_sync_at` is null **or** `x_last_tweets_sync_at` &lt; (now − 6 days). Implemented as two queries (null + lt) then merge by id.

**Frequency:** Intended weekly (e.g. once per week via Railway Cron).

**Logs:**  
`[WEEKLY] starting weekly tweet sync`, env presence, sanity counts, `query table=profiles past6d=...`, `selected_count`, `skipped_due_to_recent_sync`, per-profile `profile_id handle fetched upserted`, `[WEEKLY] done processed=... failures=... tweets_total_upserted=... skipped_due_to_recent_sync=...`

---

### 3. Queue drainer: `node dist/run_analytics_jobs.js`

**Source:** `apps/worker/src/run_analytics_jobs.ts`

**Call chain:**  
`main()` → `getSupabaseAdmin()` → fetch one row from `analytics_jobs` (status=queued, run_after ≤ now) → mark status=running → if `job_type === "x_backfill_90d"` call `runXBackfill90d(supabase, job)` → on success mark status=done (and clear last_error); on failure mark status=queued, increment attempts, set run_after (backoff 5, 15, 60 min), set last_error. Then process exits (one job per process).

**runXBackfill90d** (source: `apps/worker/src/jobs/xBackfill90d.ts`):

- Calls `ingestXTweets()` (same as weekly: fetches tweets via twitterapi.io, upserts `x_tweets`).
- Calls `getUserInfo(handle)` → twitterapi.io user info.
- Calls `getRecentTweets(handle, 1000)` again (used to build per-day aggregates in memory).
- Builds 90 days of daily buckets (tweets_count, likes, replies, retweets, quotes).
- Upserts **x_daily_snapshots** for each of 90 days (owner_type, owner_id, day, followers for today only, tweets_count, likes_received, etc.).
- Reads **x_daily_snapshots** for that profile for 7/30/90-day windows, then upserts **x_window_aggregates** (owner_type, owner_id, window_days, as_of, followers_start/end, engagement metrics, etc.).
- Updates **profiles**: `analytics_initialized_at`, `updated_at`.

**Reads:**

- **analytics_jobs**: one row (id, job_type, owner_type, owner_id, payload, attempts) where status=queued, run_after ≤ now.
- **x_daily_snapshots**: read in xBackfill90d for 7/30/90-day windows to compute aggregates.
- **x_tweets**: read in `refreshXRollupsForProfile` (weekly calls it; drainer’s xBackfill90d does not call refreshXRollupsForProfile).

**Writes:**

- **analytics_jobs**: status (running → done or queued), updated_at, last_error, attempts, run_after.
- **x_tweets**: via `ingestXTweets` (upsert).
- **x_daily_snapshots**: upsert 90 rows (one per day) per job.
- **x_window_aggregates**: upsert 3 rows (7, 30, 90 day windows) per job.
- **profiles**: `analytics_initialized_at`, `updated_at` (in xBackfill90d).

**External APIs:**

- **twitterapi.io**: `getUserInfo(handle)` → `/twitter/user/info`; `getRecentTweets(handle, 1000)` → `/twitter/user/last_tweets`. Used in both `ingestXTweets` and the in-memory aggregation in xBackfill90d.

**Frequency:** Intended every 2–5 minutes (Railway Cron) to drain the queue. One job per run; then exits.

**Logs:**  
"Failed to fetch jobs:", "No queued jobs.", "Job &lt;id&gt; done.", "Job &lt;id&gt; not marked done: no tweet inserts...", "Job &lt;id&gt; failed: &lt;error&gt;". Plus any logs from `ingestXTweets` / `getRecentTweets` (e.g. [X_TWEETS] ...).

---

## C) Overlaps and redundancy

| Concern | Fact |
|--------|------|
| **Does daily also ingest tweets?** | No. Daily runs `sync_x_profiles_daily.ts`: only user info + profile fields + one row in `x_daily_snapshots` (today) and optional `profile_analytics_baseline`. It does **not** call `ingestXTweets` or `getRecentTweets`. |
| **Does weekly ingest tweets?** | Yes. Weekly runs `sync_x_tweets_weekly.ts` → `ingestXTweets` → `getRecentTweets` → upsert `x_tweets`, then updates `profiles.x_last_tweets_sync_at` and optionally `refreshXRollupsForProfile` (x_analytics_rollups, x_top_drivers). |
| **Does drainer ingest tweets?** | Yes. Drainer runs `run_analytics_jobs` → `runXBackfill90d` → `ingestXTweets` (same path as weekly) → upsert `x_tweets`. So both weekly and drainer can write to `x_tweets`; drainer does so when processing an `x_backfill_90d` job. |
| **Duplicate work?** | **Partial.** Weekly: syncs tweets for “eligible” profiles (incremental, 6-day window) and updates `x_last_tweets_sync_at`; it also refreshes `x_analytics_rollups` and `x_top_drivers` for that profile. Drainer: processes `analytics_jobs` (e.g. 90d backfill); for each job it also calls `ingestXTweets` (tweets) then `getUserInfo` + `getRecentTweets` again and writes 90 days of `x_daily_snapshots` and 7/30/90-day `x_window_aggregates`. So: (1) **x_tweets** can be written by both weekly and drainer (different triggers: time-based vs job-based). (2) **x_daily_snapshots**: daily worker writes one row per profile per day (today only); drainer (xBackfill90d) writes 90 days of rows per job. (3) **x_window_aggregates**: only written by drainer (xBackfill90d). (4) **x_analytics_rollups** / **x_top_drivers**: only written by weekly (via `refreshXRollupsForProfile`); drainer does not call that. So there is no full duplication of one script by another; there is shared use of `ingestXTweets` and twitterapi.io between weekly and drainer. |
| **Dead code** | None identified. All three entrypoints and their called modules (ingestXTweets, refreshXRollups, xBackfill90d, twitterapi) are used. Debug scripts are for local/debug only, not used by Railway. |

---

## D) Service contract summary

### Service: linkary-worker (daily)

- **Purpose:** Sync X profile info (followers, display name, bio, avatar, engagement) and write today’s snapshot for eligible profiles. Does not ingest tweets.
- **Scripts:** `pnpm run sync:x:profiles:daily` or `pnpm run sync:x:daily` → `node dist/sync_x_profiles_daily.js`.
- **Source:** `apps/worker/src/sync_x_profiles_daily.ts`.
- **Reads:** `profiles` (id, twitter_username).
- **Writes:** `profiles` (followers_total, display_name, bio, avatar_url, avg_engagement_rate, x_last_profile_sync_at, x_sync_status, x_sync_error), `x_daily_snapshots` (one row per profile for today), `profile_analytics_baseline` (insert once per profile, ignore duplicate).
- **Calls:** twitterapi.io `GET /twitter/user/info?userName=...`.
- **Recommended schedule:** Daily (e.g. once per day).

---

### Service: linkary-worker-weekly (or linkary-worker-weekly-v2)

- **Purpose:** Sync recent tweets for eligible profiles (incremental: never synced or last sync &gt; 6 days ago), upsert into `x_tweets`, update `x_last_tweets_sync_at`, and refresh `x_analytics_rollups` and `x_top_drivers` for that profile.
- **Scripts:** `pnpm run sync:x:tweets:weekly` or `pnpm run sync:x:weekly` → `node dist/sync_x_tweets_weekly.js`.
- **Source:** `apps/worker/src/sync_x_tweets_weekly.ts`.
- **Reads:** `profiles` (id, twitter_username; plus sanity counts).
- **Writes:** `profiles` (x_last_tweets_sync_at, x_sync_status, x_sync_error), `x_tweets` (upsert), `x_analytics_rollups` (upsert), `x_top_drivers` (delete then upsert per profile/window).
- **Calls:** twitterapi.io `GET /twitter/user/last_tweets?userName=...` (via ingestXTweets → getRecentTweets).
- **Recommended schedule:** Weekly (e.g. once per week).

---

### Service: linkary-queue-drainer

- **Purpose:** Process one `analytics_jobs` row at a time (status=queued, run_after ≤ now). For `x_backfill_90d`: ingest tweets into `x_tweets`, then build 90 days of `x_daily_snapshots` and 7/30/90-day `x_window_aggregates`, and set `profiles.analytics_initialized_at`. On success mark job done; on failure requeue with backoff.
- **Scripts:** `pnpm run run:jobs` → `node dist/run_analytics_jobs.js`.
- **Source:** `apps/worker/src/run_analytics_jobs.ts` (+ `src/jobs/xBackfill90d.ts`).
- **Reads:** `analytics_jobs` (one queued job), `x_daily_snapshots` (in xBackfill90d for 7/30/90-day aggregation).
- **Writes:** `analytics_jobs` (status, updated_at, last_error, attempts, run_after), `x_tweets` (via ingestXTweets), `x_daily_snapshots` (90 rows per job), `x_window_aggregates` (3 rows per job), `profiles` (analytics_initialized_at, updated_at).
- **Calls:** twitterapi.io `GET /twitter/user/info` and `GET /twitter/user/last_tweets` (via getUserInfo, getRecentTweets, and ingestXTweets).
- **Recommended schedule:** Every 2–5 minutes (to drain the queue without leaving jobs stuck).
