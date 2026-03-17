# X analytics pipeline — diagnostics (internal/support)

Use this when a profile has **followers populated but posts/impressions/engagement zero**, or when analytics UI does not update after sync.

**No PII in logs.** Use profile_id (UUID) only where needed for support.

---

## Pipeline stages (worker)

| Stage | Log prefix | Meaning |
|--------|------------|--------|
| fetch_start | `[X_TWEETS] stage=fetch_start profile_id=... handle=...` | About to call twitterapi.io for tweets. |
| fetch_done | `[X_TWEETS] stage=fetch_done profile_id=... fetched=N` | API returned N tweets. |
| dedupe | `[X_TWEETS] stage=dedupe profile_id=... rows_before=X rows_after=Y` | Only present if duplicates were removed (X > Y). |
| upsert_done | `[X_TWEETS] stage=upsert_done profile_id=... deduped=N upserted=N` | x_tweets upsert completed. |
| done | `[X_TWEETS] stage=done profile_id=... upserted=N` | ingestXTweets finished. |
| snapshots_done | `[X_BACKFILL_90D] stage=snapshots_done profile_id=... days=90` | x_daily_snapshots written. |
| aggregates_done | `[X_BACKFILL_90D] stage=aggregates_done profile_id=... windows=7,30,90` | x_window_aggregates written. |
| done (backfill) | `[X_BACKFILL_90D] stage=done profile_id=... upserted=N` | Full backfill succeeded. |

If a stage is missing in logs for a profile, the job failed before that stage.

---

## “Followers present but posts zero”

**Meaning:** Follower count (e.g. in x_daily_snapshots or profile) is set, but posts/impressions/engagement in the UI are zero.

**Likely cause:** Tweet ingestion failed or never ran, so `x_tweets` is empty or stale for that profile.

**Check:**

1. **Supabase → x_tweets:** Filter by `profile_id = <that profile UUID>`. If empty or very old, tweet ingestion failed or has not run.
2. **Railway logs:** Search for `profile_id=<uuid>` and `[X_TWEETS]`. Look for:
   - `stage=upsert_done` → tweets were written.
   - `upsert failed` or no `stage=upsert_done` → ingest failed (e.g. duplicate key before fix, or API error).
3. **Fix:** Ensure worker dedupe fix is deployed; re-run backfill or weekly sync for that profile.

---

## “x_tweets present but aggregates missing”

**Meaning:** `x_tweets` has rows for the profile but x_daily_snapshots or x_window_aggregates are empty or stale.

**Likely cause:** Backfill failed **after** ingestXTweets (e.g. snapshots or aggregates write failed).

**Check:**

1. **Supabase → x_daily_snapshots:** Filter `owner_type=profile`, `owner_id=<profile uuid>`. If empty, snapshot step failed.
2. **Supabase → x_window_aggregates:** Same owner_id. If empty, aggregates step failed.
3. **Railway logs:** Look for `stage=snapshots_done` and `stage=aggregates_done`. If you see `stage=upsert_done` but not `snapshots_done`, error is in snapshot loop (e.g. constraint or RLS). If you see `snapshots_failed` or `aggregates_failed`, log line includes `error=...`.

---

## “Aggregates present but UI still zero”

**Meaning:** DB has x_tweets and/or x_daily_snapshots / x_window_aggregates for the profile, but the analytics page shows zero.

**Likely cause:** Wrong profile id used when reading (e.g. session id instead of viewed profile), or window filter has no data in range, or cache/staleness.

**Check:**

1. **Own analytics:** `/api/analytics/x` and `/api/analytics/x/summary` use the **logged-in user’s id** only. So the own analytics page always shows that user’s data. Correct.
2. **Other-user analytics:** `/api/me/analytics/profile/[username]` resolves the **viewed profile** by username and reads **x_window_aggregates** with `owner_id = viewed profile id`. If the UI is the cross-user analytics page (e.g. /app/analytics/profile/other), it calls this route; no session/profile mix-up. If aggregates exist in DB for that profile but UI shows zero, check that the route is actually called with the correct username and that the profile is published.
3. **Window:** Own API filters by `tweeted_at` and `day` in the selected window. Other-user uses latest x_window_aggregates row per window (7/30/90). If all tweets are outside the window, counts can be zero. Try 90d.
4. **Stale:** Force refresh; ensure no aggressive client cache.

---

## Data flow summary

- **twitterapi.io** → worker `getRecentTweets` / `getUserInfo`
- **Worker** → `ingestXTweets` → dedupe → upsert into **x_tweets**
- **Worker** (xBackfill90d) → same or second fetch → **x_daily_snapshots** (per day) → **x_window_aggregates** (7/30/90d)
- **Own analytics:** GET `/api/analytics/x` and GET `/api/analytics/x/summary` use **session user id** for `owner_id` / `profile_id`. They read **x_daily_snapshots** (followers) + **x_tweets** (posts, engagement, impressions) and **x_window_aggregates** (summary). All from stored tables.
- **Other-user analytics:** GET `/api/me/analytics/profile/[username]` resolves the **viewed profile** by username, then reads **x_window_aggregates** for `owner_type=profile`, `owner_id=<viewed profile id>`. Same worker-populated source as own summary; no longer uses x_analytics_rollups (which backfill does not fill).

All metrics come from stored tables; no live fetch from twitterapi.io on page load.

---

## Other-user analytics: profile mapping

- **Route:** `/api/me/analytics/profile/[username]`. URL username is normalized (trim, lower, strip @).
- **Viewed profile:** Fetched from `public_profile_view` by `username`; `profileId = profileRow.id`. If `profileId === session user id`, the API returns 400 USE_OWN_ANALYTICS (caller must use `/api/analytics/x` for own data).
- **Data source:** `x_window_aggregates` where `owner_type='profile'` and `owner_id=profileId` (the viewed profile). Latest row per `window_days` (7, 30, 90) is used; mapped to allowlisted analytics shape (posts_7d/30d/90d, avg_likes_30d, etc.).
- **If “other-user” page shows zero:** Confirm in DB that `x_window_aggregates` has rows for that profile’s id. If backfill completed (worker logs `stage=aggregates_done`), aggregates exist; if not, run backfill for that profile.

---

## Metric sources (stored data only)

| Metric | Own analytics (GET /api/analytics/x) | Other-user (GET /api/me/analytics/profile/[username]) |
|--------|-------------------------------------|--------------------------------------------------------|
| Followers | x_daily_snapshots (followers) + kpis.followers_latest | Not in allowlist; profile card only |
| Posts (7d/30d/90d) | x_tweets in window → kpis.posts_total | x_window_aggregates.posts_count per window |
| Impressions | x_tweets.impression_count in window | Not in allowlist |
| Engagement rate | From x_tweets (engagements/impressions) in window | x_window_aggregates.avg_engagement_rate (30d) |
| Avg likes/replies | From x_tweets in window | x_window_aggregates.avg_likes_per_post, avg_replies_per_post |
| Reach proxy | kpis.potential_reach (impressions) | x_window_aggregates.reach_avg |

Zero in the UI means either no data in that window or no synced data yet (backfill not run / failed). No fake or invented values.

---

## Truthfulness: stale vs missing vs zero

- **No X handle connected:** Profile has no twitter_username / X not connected. Analytics entry points should direct to connect X (no metrics).
- **No synced X data yet:** Backfill not run or failed. x_tweets / x_daily_snapshots / x_window_aggregates empty for that profile. UI should show “no data yet” or “building…” (e.g. init-status), not invented numbers.
- **Synced but no data in this window:** Data exists for other windows or older dates; selected 7d/30d/90d has no tweets. Zero is correct; avoid implying “error”.
- **Stale / old sync:** Data exists but last sync was long ago. Where we have `x_last_profile_sync_at` or `analytics_initialized_at`, own analytics can show “Last updated: X” (e.g. AnalyticsTabContent). We do not fake a last-sync time when we don’t have one.
- **Partial data:** e.g. followers populated (from profile or one snapshot) but tweet-derived metrics zero because ingest failed after profile sync. Diagnostics above (“Followers present but posts zero”) apply.
