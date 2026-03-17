# Production reliability checklist — CRM bootstrap & X analytics

Single operator-ready checklist for both live issues: CRM task board bootstrap and X analytics ingestion.

---

## CRM bootstrap

### Env / config (no code change)

- **Cookie domain:** For crm.linkary.xyz to share auth with linkary.xyz, set `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` in both apps. If not set, users may need to sign in again on the CRM subdomain.
- **Vercel (or host):** Same Supabase env vars as main app (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) so the CRM can talk to the same DB.

### Data requirements

- **profiles:** Row must exist for the user with `id = auth.uid()`, `profile_type = 'individual'`, `published = false` (or valid per schema). Any extra NOT NULL columns must be satisfied or the minimal profile insert fails.
- **crm_current_profile_id():** Returns `SELECT id FROM profiles WHERE id = auth.uid()`. If no profile row, returns NULL and RLS blocks workspace/board inserts.

### What to inspect when "We couldn't create your task board"

1. **Supabase → Authentication → Users:** Confirm the user exists and note their UUID.
2. **Supabase → Table Editor → profiles:** Is there a row with `id = that UUID`? If not, profile insert failed or was never run (e.g. session not sent to CRM).
3. **?debug=1:** User opens `/tasks?debug=1`; note the **reason** and **stage** on the error card. Server logs show `[CRM bootstrap] failed: reason=... stage=...`.
4. **Supabase logs:** Check for INSERT errors on `crm_workspaces`, `crm_workspace_members`, `crm_boards`. 23505 = duplicate (slug or member); 42501 = RLS.
5. **RLS:** Creator workspace insert is allowed when `owner_profile_id = crm_current_profile_id()`. So profile must exist for `auth.uid()`.

### Likely causes (after code fixes)

- Session not sent to CRM (cookie domain or user signed in only on main app).
- No profile row for user (insert failed due to NOT NULL, or 23505 and re-fetch not finding row).
- RLS blocking insert because `crm_current_profile_id()` is NULL.

---

## X analytics ingestion

### Worker error fixed

- **"ON CONFLICT DO UPDATE command cannot affect row a second time"** — Caused by upserting the raw `rows` array instead of the **deduped** array. Same (profile_id, tweet_id) in one batch triggers this. **Fix:** Worker now upserts `deduped` only (dedupe by `profile_id:tweet_id` before DB).

### Env / config

- **Railway (worker):** `TWITTERAPI_API_KEY` (or `TWITTERAPI_IO_KEY` / etc.) must be set. Worker uses it for `getUserInfo` and `getRecentTweets` (twitterapi.io).
- **Supabase:** Worker uses same Supabase URL/key as app; writes to `x_tweets`, `x_daily_snapshots`, `x_window_aggregates`; updates `profiles.analytics_initialized_at`.

### Which jobs do what

- **xBackfill90d:** For one profile, fetches user info (followers), fetches recent tweets **once**, passes them to ingestXTweets (preFetchedTweets), upserts into `x_tweets`, then builds dayMap from the same tweet list and fills `x_daily_snapshots` and `x_window_aggregates`. Sets `analytics_initialized_at` on success. Logs: fetch_start → fetch_done → ingest_done → snapshots_done → aggregates_done → done.
- **ingestXTweets:** Used by backfill (with preFetchedTweets) and by sync_x_tweets_weekly (fetches itself). Skips retweets and (optionally) outliers, dedupes by (profile_id, tweet_id), upserts into `x_tweets`.
- **sync_x_tweets_weekly:** Runs ingestXTweets for profiles that need it (e.g. weekly refresh).

### Tables that should have data after successful ingestion

- **x_tweets:** Rows per (profile_id, tweet_id). Drives posts count, impressions, engagement.
- **x_daily_snapshots:** Rows per (owner_type, owner_id, day). Follower count and daily aggregates.
- **x_window_aggregates:** Rollups per (owner_type, owner_id, window_days, as_of). Used for KPIs.
- **profiles:** `analytics_initialized_at` set when backfill completes; `x_last_tweets_sync_at` / `x_last_profile_sync_at` updated by sync if present.

### Followers populated but posts/impressions/engagement zero

- **Cause:** Follower count comes from `getUserInfo` (one call). Posts/impressions/engagement come from `x_tweets`. If tweet ingestion failed (e.g. duplicate key error before the fix, or API/worker failure), `x_tweets` stays empty or stale while followers can still be written (e.g. from daily snapshot or backfill step).
- **Check:** For the affected profile, query `x_tweets` for that `profile_id`. If empty or old, ingestion for that profile failed or never ran. Check Railway logs for `[X_TWEETS]` and `[X_BACKFILL_90D]` and any upsert error.

### How to verify dedupe correctness

- Logs now show `deduped=N` and, when duplicates were removed, `deduped X -> Y rows`. Upsert payload is always deduped by (profile_id, tweet_id) before send.
- If you still see "cannot affect row a second time", the batch sent to Postgres still has duplicate keys — then check for any other code path that builds an array and upserts it without deduping.

### Railway logs (actionable)

- `[X_TWEETS] start profile_id=... handle=...` — ingestion started.
- `[X_TWEETS] fetched=N skipped_retweets=M deduped=K upserted=K` — success.
- `[X_TWEETS] deduped X -> Y rows` — duplicates were in the batch and removed.
- `[X_TWEETS] upsert failed. ... error=...` — DB error; message includes conflict_target and sample_keys.
- `[X_OUTLIER]` — tweet skipped due to outlier engagement vs followers.

---

## twitterapi.io usage (current)

- **Endpoints used:**  
  - `GET /twitter/user/info?userName=...` — follower count, etc.  
  - `GET /twitter/user/last_tweets?userName=...&includeReplies=false&cursor=...` — paginated tweets.
- **Who calls them:** Worker only (ingestXTweets → getRecentTweets, xBackfill90d → getUserInfo + getRecentTweets). Apps/web does not call twitterapi.io on page load; analytics UI reads from Supabase (x_tweets, x_daily_snapshots, etc.).
- **How often:** Per backfill job once per profile (up to 1000 tweets in backfill); weekly sync runs ingestXTweets for profiles that need refresh. Rate limiting: delay between requests (e.g. 200–400 ms) in worker.
- **Cost-effectiveness:** Data is stored once; app reads from DB. Backfill is one-time per profile (or on-demand); daily/weekly sync can be bounded by only syncing profiles with X handle and last_sync older than X days. No live fetch on page load.
- **Single-fetch backfill:** xBackfill90d now fetches tweets once, passes them to ingestXTweets via `preFetchedTweets`, and reuses the same list for dayMap/snapshots/aggregates. Logs: `[X_BACKFILL_90D] stage=fetch_done` then `[X_TWEETS] stage=fetch_skip preFetched=N`.

---

## Summary

| Area | Root cause (if any) | Fix applied | External condition |
|------|---------------------|-------------|--------------------|
| CRM bootstrap | Profile 23505 now re-fetched; workspace 23505 retried. | Code: profile duplicate handling; workspace 23505 retry; observability. | Session present (cookie domain); profile exists; RLS allows. |
| X analytics "cannot affect row twice" | Batch had duplicate (profile_id, tweet_id); we upserted `rows` instead of `deduped`. | Code: upsert `deduped` only; logging with deduped count and sample keys. | twitterapi.io key set; worker has DB access; API returns tweets. |
| Followers vs posts zero | Tweet ingestion failed (above error), so x_tweets empty. | Same fix; after deploy, re-run backfill or sync for affected profiles. | — |

---

## Doc references

- CRM bootstrap root cause and debug: **docs/CRM_BOOTSTRAP_ROOT_CAUSE_AND_DEBUG.md**
- CRM individual task setup (manual SQL, CTA, states): **docs/CRM_INDIVIDUAL_TASKS_SETUP.md**
- Analytics behavior (same UI for all; X data when handle + sync): **docs/ANALYTICS_BEHAVIOR.md**
- Analytics pipeline diagnostics (followers vs posts zero, stages, failure points, other-user mapping, metric sources, truthfulness): **docs/ANALYTICS_PIPELINE_DIAGNOSTICS.md**
- Analytics phase operator checklist (single-fetch verification, tables, logs, freshness, Sync now recommendation): **docs/ANALYTICS_PHASE_OPERATOR_CHECKLIST.md**
- QA checklist (individual tasks): **docs/CRM_QA_CHECKLIST_INDIVIDUAL_TASKS.md**
