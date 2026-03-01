# Analytics QA Pass & Ingestion Follow-up

After the analytics “honest UI” changes (Data Status line, no zero-filled charts, rebuild + polling), use this for a tight QA pass and for the next step **only if** the backend is not producing data.

---

## 1. Is it OK to ship?

**Yes, beta OK** because:

- The UI reflects reality instead of guessing.
- You have a user-facing way to confirm freshness and trigger rebuild.
- Polling stops automatically and revalidates the charts.

---

## 2. 10–15 min QA checklist

### 2.1 Validate the Data Status line

Open **Analytics** and check:

- **Tweets in window** is not 0 (try 7D, 30D, and 90D).
- **Last tweet** is recent.
- **Rollup updated** changes after you click Rebuild.

If **Tweets in window** is 0, charts will correctly show “No posts found in this period.” That’s expected and means ingestion didn’t happen (or wrong account/profile id).

### 2.2 Hit the API once to confirm it matches the UI

Call **`GET /api/analytics/x`** (logged in) and verify `data_status`:

- `tweet_count_7d`, `tweet_count_30d`, `tweet_count_90d`
- `last_tweet_at`
- `rollup_updated_at`

- If the API says `tweet_count_30d` is e.g. 40 but the chart still looks empty → chart mapping bug.
- If the API says `tweet_count_30d` is 0 → ingestion/backfill.

### 2.3 Rebuild flow test (most important)

1. Click **Rebuild**.
2. You should see “Rebuild queued… polling every 15s”.
3. Within a minute or two:
   - `rollup_updated_at` should change.
   - Charts should re-render.
   - Polling should stop.

- If `rollup_updated_at` **never** changes → rebuild job is not writing rollups, or the job is failing.
- If it still “doesn’t update” after this → UI is doing its job; the issue is backend (see below).

---

## 3. If it still doesn’t update after QA

Then the UI is correct and the issue is one of:

- **Tweets not ingested** – `x_tweets` not receiving new rows.
- **Rollups not recomputed** – `x_window_aggregates` not updated.
- **Profile id mismatch** – jobs writing to a different profile id than the UI reads.

Use the **NEXT Cursor prompt** below **only if** QA shows data is missing (e.g. tweet_count is 0 or rollup_updated_at never changes), not for UI fixes.

---

## 4. NEXT Cursor prompt (ingestion/rebuild only)

Copy-paste this **only if** tweet_count is 0 or rollup_updated_at never changes:

```
NEXT CURSOR PROMPT: Fix ingestion/rebuild so analytics actually produces data

Goal
Analytics UI is now honest. If charts are empty, it's because backend data is missing or rollups aren't updating. Fix the backend so:

- x_tweets is populated for connected X users
- rebuild writes x_window_aggregates and updates rollup_updated_at reliably

Tasks

1) Add a server-side "diagnostics" response to /api/analytics/x (owner-only):
   - connected_x: boolean
   - twitter_username
   - tweets_last_7d_count, tweets_last_30d_count, tweets_last_90d_count
   - latest_tweet_at
   - latest_rollup_updated_at
   - last_job_status for this profile (if jobs table exists)

2) Ensure rebuild endpoint/job:
   - enqueues the correct job_type with payload.profile_id = user.id
   - writes/updates x_window_aggregates.updated_at for the profile
   - logs job status transitions (queued -> running -> done) with profile_id

3) Add one button near Rebuild:
   - "Backfill 90D tweets" (owner-only)
   - triggers the existing xBackfill90d path, then runs rebuild

Acceptance
- After backfill + rebuild, tweet_count_30d is > 0 and charts show real bars
- rollup_updated_at updates after rebuild
```

---

*Last updated: after analytics honest-UI + Data Status + rebuild polling implementation.*
