# Analytics Page Finalization: PR Summary and QA Checklist

## Root cause statement (one sentence)

**If the DB has 90D data (snapshots and/or tweets for the profile), the API returns it and the UI now shows it; empty states were tied to coverage/day counts instead of “do we have enough chart points,” so we now derive insufficient state from `points.length < 3` so that 90D weekly (e.g. 13 points) is never hidden. If the DB does not have 90D data, the API debug conclusion and audit script make the reason explicit and the Phase 2 backfill plan documents how to backfill and keep data fresh.**

---

## Summary of changes

### Phase 1 – Hard proof of data

- **1A) DB audit**  
  - Added `apps/web/scripts/auditAnalyticsData.ts`.  
  - Run: `pnpm exec tsx apps/web/scripts/auditAnalyticsData.ts --user <profile_id>` (or `PROFILE_ID=<uuid>`).  
  - Prints: snapshot counts 7d/30d/90d, min/max snapshot day in 90d, tweet count 90d, window_aggregates existence.  
  - Includes SQL equivalents in output for Supabase (replace `:profile_id`).

- **1B) API audit**  
  - `GET /api/analytics/x?window=7d|30d|90d&debug=1` already returns chart_points lengths, first/last dates, non-zero counts, KPI rollup, why_empty_hint.  
  - Added **forced conclusion** in `payload.debug.conclusion`:  
    - "DB has 90D data and API returns it. If UI still shows 'not enough data', UI is hiding it (check empty state conditions)."  
    - "DB has 90D data but API is not returning enough chart points (window filter or aggregation bug)."  
    - "DB does not have 90D data for this profile (collector/backfill never ran or failed). Run audit script; see docs and Phase 2 backfill plan."  
  - Analytics debug panel (`?debug=1`) shows this conclusion.

### Phase 2 – When data is missing

- **2A–2C**  
  - `docs/ANALYTICS_PHASE2_BACKFILL_PLAN.md`: why data may be missing, how to backfill safely (existing job + cron, optional script), how to keep data fresh (cron/worker schedule).  
  - No new backfill script added; existing worker + `backfill-x-90d-batch` and `POST /api/analytics/backfill-90` are the primary backfill path.

### Phase 3 – UI no longer hides valid data

- **Empty state logic**  
  - **Follower:** `followerInsufficient = followerGrowthPoints.length < 3` (was `followerCoverageDays < 3`). So when API returns 13 weekly points, the chart is shown.  
  - **Engagement:** `insufficientForTrend = engagementRatePoints.length < 3` (was based on `engagement_data_coverage_days <= 2`).  
  - **Cadence:** `insufficientForTrend = postingCadencePoints.length < 3` (was `tweet_count_window <= 2`).  
  - So “not enough data” only when we have fewer than 3 chart points; if DB/API have 90d and we get 90 daily or 13 weekly points, we show the chart.

- **Bucketing**  
  - Unchanged: 7D/30D daily, 90D weekly (aggregation in `utils.ts`); ChartCard shows “Daily” or “Weekly” via `bucketLabel`.  
  - Coverage remains X/90d; axis reflects week buckets for 90D.

### Phase 4 – Signal-first and docs

- **Layout**  
  - Key Signals first, then KPIs, then Trends, then Details (Top Drivers with “Posts in window,” sort by ER). Already in place from prior work.  
  - No global CSS; styles scoped to analytics / `data-page="analytics"`.  
  - No long dashes in copy.

- **Docs**  
  - `docs/ANALYTICS_EXPERT_PLAN.md`: expert roles, order of execution, success criteria.  
  - `docs/ANALYTICS_PHASE2_BACKFILL_PLAN.md`: backfill and keep-fresh.  
  - `docs/ANALYTICS_WHY_EMPTY.md`: existing; unchanged.  
  - This file: PR summary and QA checklist.

---

## SQL queries (for manual DB proof)

Run in Supabase SQL editor; replace `:profile_id` with the profile UUID.

```sql
-- Snapshot counts per window
SELECT COUNT(*) AS snapshot_count_7d  FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 6)::text  AND day <= CURRENT_DATE::text;
SELECT COUNT(*) AS snapshot_count_30d FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 29)::text AND day <= CURRENT_DATE::text;
SELECT COUNT(*) AS snapshot_count_90d FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 89)::text AND day <= CURRENT_DATE::text;

-- Min/max snapshot day in last 90 days
SELECT MIN(day) AS min_day, MAX(day) AS max_day FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 89)::text AND day <= CURRENT_DATE::text;

-- Tweet count in last 90 days
SELECT COUNT(*) AS tweet_count_90d FROM x_tweets WHERE profile_id = :profile_id AND tweeted_at >= (NOW() - INTERVAL '90 days');

-- Window aggregates for 7/30/90
SELECT window_days, COUNT(*) AS n FROM x_window_aggregates WHERE owner_type='profile' AND owner_id = :profile_id AND window_days IN (7, 30, 90) GROUP BY window_days;
```

---

## Manual QA checklist

- [ ] **7D**  
  - Select 7D; charts show daily points; labels/copy make sense; no “not enough data” if API returns data.  
  - KPIs and Key Signals match 7d window.

- [ ] **30D**  
  - Select 30D; charts show daily points (compact); no incorrect empty states.  
  - KPIs and Key Signals match 30d window.

- [ ] **90D**  
  - Select 90D; charts show weekly buckets (~13 points); “Weekly” label visible; no horizontal scroll required to read.  
  - No “not enough data” when DB has 90d data and API returns points.  
  - KPIs and Key Signals match 90d window.

- [ ] **Data existence**  
  - With a profile that has 90d data: load analytics with `?debug=1`; open debug panel; confirm **Conclusion** says “DB has 90D data and API returns it”; no “not enough data” on charts.  
  - With a profile that has no 90d data: Conclusion says “DB does not have 90D data”; why_empty_hint suggests next steps; run `auditAnalyticsData.ts` for that profile and confirm counts match.

- [ ] **Signals and KPIs**  
  - Key Signals: 4–6 bullets when computable; each includes a number; no filler.  
  - Posts = 0 shows “0”; per-post KPIs show “—” with “No posts in this window.”  
  - Delta missing shows “—” and “Need prior period.” where applicable.  
  - No fake deltas.

- [ ] **Top Drivers**  
  - “Posts in window: N” shown when provided; default sort by ER; compact.

- [ ] **Regressions**  
  - No console errors on analytics page.  
  - No changes to non-analytics routes or global styles.  
  - Rest of app (navigation, settings, dashboard) behaves as before.

- [ ] **Before/after**  
  - Optional: screenshot 7D, 30D, 90D before and after for a profile with data and for a profile without data.

---

## Files touched

| Area | Files |
|------|--------|
| Audit | `apps/web/scripts/auditAnalyticsData.ts` (new) |
| API | `apps/web/src/app/api/analytics/x/route.ts` (conclusion, why_empty_hint already present) |
| UI | `apps/web/src/figma/app/components/AnalyticsPage.tsx` (conclusion in debug panel; empty state from points.length) |
| Docs | `docs/ANALYTICS_EXPERT_PLAN.md`, `docs/ANALYTICS_PHASE2_BACKFILL_PLAN.md`, `docs/ANALYTICS_PR_SUMMARY_AND_QA.md` |

No API response shape change for non-debug; `debug.conclusion` is additive when `debug=1`.
