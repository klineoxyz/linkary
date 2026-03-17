# X analytics phase — operator verification checklist

Use this after deploying the single-fetch backfill, stage logging, and freshness UX. No PII in logs or this doc.

---

## 1. Verify single-fetch backfill (one tweet fetch per run)

- **Code:** `apps/worker/src/jobs/xBackfill90d.ts` fetches tweets once with `getRecentTweets(handle, MAX_TWEETS)` then passes them to `ingestXTweets(..., { preFetchedTweets: tweets })`. There is no second `getRecentTweets` call.
- **Logs:** For one backfill run, search Railway for `[X_BACKFILL_90D]` and the same `profile_id`. You should see:
  - `stage=fetch_start` then `stage=fetch_done profile_id=... fetched=N` (one fetch).
  - `[X_TWEETS] stage=fetch_skip profile_id=... preFetched=N` (ingest used pre-fetched list, no second API call).
- **Absence of:** A second `stage=fetch_start` or `stage=fetch_done` from ingest for the same profile in the same run. If you see two fetch_done for the same profile in one run, the optimization is not active.

---

## 2. Verify x_tweets, x_daily_snapshots, x_window_aggregates populate

- **Supabase → x_tweets:** Filter by `profile_id = <test profile UUID>`. After a successful backfill there should be rows (up to 1000 per profile). Check `tweeted_at` range.
- **Supabase → x_daily_snapshots:** Filter `owner_type = 'profile'`, `owner_id = <same UUID>`. Expect up to 90 rows (one per day). `day` from ~90 days ago to today.
- **Supabase → x_window_aggregates:** Same `owner_id`. Expect rows with `window_days` in (7, 30, 90) and same `as_of` (today).
- **Railway logs:** For that profile, in order: `stage=fetch_done` → `stage=ingest_done` → `stage=snapshots_done` → `stage=aggregates_done` → `stage=done`. If any stage is missing, the pipeline failed at that step (see ANALYTICS_PIPELINE_DIAGNOSTICS.md).

---

## 3. Verify own analytics and other-user analytics read correct sources

- **Own analytics:** GET `/api/analytics/x` and `/api/analytics/x/summary` use the **session user id** for `owner_id` / `profile_id`. They read `x_daily_snapshots`, `x_tweets`, and `x_window_aggregates`. No twitterapi.io call on page load.
- **Other-user analytics:** GET `/api/me/analytics/profile/[username]` resolves the **viewed profile** by username and reads **x_window_aggregates** for `owner_type='profile'`, `owner_id=<viewed profile id>`. Same worker-populated source as own summary.
- **Check:** View own analytics → numbers should match DB for your user id. View another user’s analytics (e.g. /app/analytics/profile/other) → numbers should match x_window_aggregates for that profile’s id, not the viewer’s.

---

## 4. Verify stale vs missing vs partial in UI

- **No X handle:** Connect X in Integrations. On analytics page, message should say “Connect your X handle in Integrations to see analytics here.”
- **No synced data yet:** After connecting X but before any sync/backfill, message: “Sync from Integrations to populate data. No synced data yet.”
- **No activity in window:** When there is sync but no tweets in the selected 7d/30d/90d window, message: “No activity in this time window. Try 90d or sync again from Integrations.”
- **Last updated:** When `x_last_profile_sync_at` exists, the header should show “Last updated: Xm ago” / “Xd ago” (from stored timestamp only).
- **Other-user:** No private sync timestamps. Only “No analytics data yet” or the analytics snapshot; no “last synced” for another user.

---

## 5. Railway logs to inspect

| Log pattern | Meaning |
|-------------|--------|
| `[X_BACKFILL_90D] stage=fetch_start` | About to call getRecentTweets (once per run). |
| `[X_BACKFILL_90D] stage=fetch_done profile_id=... fetched=N` | Tweet fetch completed. |
| `[X_TWEETS] stage=fetch_skip profile_id=... preFetched=N` | Ingest using pre-fetched tweets (no second fetch). |
| `[X_BACKFILL_90D] stage=ingest_done profile_id=... upserted=N (snapshots next)` | x_tweets written; snapshots/aggregates not yet done. |
| `[X_BACKFILL_90D] stage=snapshots_done` | x_daily_snapshots written. |
| `[X_BACKFILL_90D] stage=aggregates_done` | x_window_aggregates written. |
| `[X_BACKFILL_90D] stage=done` | Full pipeline success. |
| `stage=snapshots_failed` / `stage=aggregates_failed` | Partial success; error message and which stage failed. |

---

## 6. Supabase tables to inspect

| Table | Key columns | What to check |
|-------|-------------|----------------|
| x_tweets | profile_id, tweet_id, tweeted_at | Rows for profile after backfill; no duplicate (profile_id, tweet_id). |
| x_daily_snapshots | owner_type, owner_id, day | One row per day per profile (up to 90). |
| x_window_aggregates | owner_type, owner_id, window_days, as_of | 7, 30, 90 for profile; used by own summary and other-user route. |
| profiles | analytics_initialized_at, x_last_profile_sync_at | Set when backfill completes; used for freshness in UI. |
| analytics_jobs | owner_id, job_type, status | x_backfill_90d jobs; queued → running → done/failed. |

---

## 7. External conditions

- **twitterapi.io:** API key set in worker env (`TWITTERAPI_API_KEY` or equivalent). Worker calls `getUserInfo` and `getRecentTweets` only; no key needed in apps/web for page load.
- **Worker:** Has Supabase access (service role or equivalent) to write x_tweets, x_daily_snapshots, x_window_aggregates and to read profiles.
- **X handle:** Profile must have `twitter_username` (or payload.username for job) for backfill to run.

---

## 8. “Sync now” recommendation

- **Existing triggers:** POST `/api/x-sync` (self-only, 24h cooldown, profile + snapshot + enqueue backfill; no tweet fetch in web). POST `/api/analytics/x/rebuild` (enqueue x_backfill_90d for current user; idempotent if job already queued/running; no rate limit in route).
- **Recommendation:** **Do not add a prominent “Sync now” on the analytics page** without rate limiting (e.g. 1 rebuild per hour per user). Prefer directing users to **Settings → Integrations** for sync/refresh. If you add a “Request refresh” button that calls rebuild, add the same rate limit as x-sync (e.g. 5 per 10 min or 1 per hour) to avoid cost spikes and abuse. **Safe only in Settings/Integrations** unless rebuild is rate-limited; then **safe to add** with clear “Request refresh (may take a few minutes)” copy.
