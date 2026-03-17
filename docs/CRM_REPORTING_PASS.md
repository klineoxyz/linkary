# CRM reporting + promoted-account growth pass — deliverables

**Priority order:** 1) Reporting data layer, 2) Promoted-account growth, 3) Campaign final report UI, 4) Finalize preparation.

---

## 1. Exact schema/data changes

| Change | File / location |
|--------|------------------|
| New table **crm_campaign_account_snapshots** | `supabase/migrations/20260418000000_crm_campaign_account_snapshots.sql` |
| Columns: campaign_id, platform, handle, snapshot_type (baseline \| daily \| end), snapshot_at, metrics (jsonb: followers, views, likes, replies, quotes, reposts, engagement_total), created_at | Same migration |
| RLS: SELECT/INSERT/UPDATE for workspace members of campaign’s workspace | Same migration |
| New column **crm_campaigns.finalized_at** (timestamptz, nullable) | `supabase/migrations/20260418000001_crm_campaign_finalized_at.sql` |
| CampaignRow + getCampaign select include finalized_at | `apps/crm/src/lib/campaigns.ts` |

---

## 2. Exact files touched

| File | Change |
|------|--------|
| `supabase/migrations/20260418000000_crm_campaign_account_snapshots.sql` | **New.** Snapshots table + RLS. |
| `supabase/migrations/20260418000001_crm_campaign_finalized_at.sql` | **New.** finalized_at on crm_campaigns. |
| `apps/crm/src/lib/campaigns.ts` | CampaignRow.finalized_at; getCampaign select includes finalized_at. |
| `apps/crm/src/lib/snapshots.ts` | **New.** Snapshot types, upsertAccountSnapshot, getAccountSnapshots, getAccountGrowth. |
| `apps/crm/src/lib/report.ts` | **New.** getCampaignReportData: aggregates campaign, KPIs, daily metrics, top contributors + contribution, submissions, chart series, account growth. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/report/page.tsx` | **New.** Report page: overview, metrics, top contributors, engagement chart, account growth, submissions. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` | “View report” link to `/campaigns/[id]/report`. |
| `docs/CRM_FINALIZE_AND_REPORT_PREP.md` | **New.** Finalize step, approved-only, storing final share. |
| `docs/CRM_REPORTING_PASS.md` | This file. |

---

## 3. Reporting/growth behavior implemented

- **Snapshots:** Insert via `upsertAccountSnapshot(supabase, campaignId, platform, handle, snapshotType, snapshotAt, metrics)`. Metrics are stored only (no fake data). Keyed by campaign_id + (platform, handle); snapshot_type = baseline | daily | end.
- **Growth:** `getAccountGrowth(supabase, campaignId)` returns per (platform, handle): baseline metrics, end metrics, follower_growth, views_growth, engagement_growth (deltas). Used for “Promoted-account growth (baseline → end)” on report.
- **Report data:** `getCampaignReportData(supabase, campaignId)` returns campaign, promoted_org_id, promoted_social_handles, dates, campaign value, total posts/views/engagements, likes/replies/quotes/reposts (from end snapshots when present), contributor count, top contributors with contribution %, submissions, chart_series from crm_campaign_metrics_daily, account_growth, has_metrics, finalized_at.
- **Report UI:** Route `/campaigns/[id]/report` shows: campaign name, promoted project, tracked accounts, start/end/reward date, campaign value, total posts, total views, total engagements, likes/replies/quotes/reposts, contributor count, top contributors table (with contribution %), engagement-over-time chart (bar from daily metrics), promoted-account growth table, submissions table. All from stored data; “—” when no data.

---

## 4. What operators can now see

- **Campaign detail:** “View report” link to the new report page.
- **Report page:** Full campaign report: overview (name, promoted project, tracked accounts, dates, reward date, value); metrics grid (posts, views, engagements, likes, replies, quotes, reposts, contributors); top contributors with submission count and contribution %; engagement chart over time; promoted-account growth (baseline → end) per account; submissions table. Finalized badge when finalized_at is set.

---

## 5. What should come next after this

- **Snapshot ingestion:** Way to record baseline (e.g. when campaign starts or on “Record baseline” button), daily snapshots (cron or manual), and end snapshot (on finalize or “Record end”). Data source for metrics (followers, views, likes, etc.) is out of scope here; can be API jobs or manual entry.
- **Finalize action:** “Finalize campaign” button that sets finalized_at and optionally runs approved-only contribution and records end snapshots (see CRM_FINALIZE_AND_REPORT_PREP.md).
- **Export:** CSV/PDF export of report.
- **Likes/replies/quotes/reposts at campaign level:** Currently from sum of end snapshots per account; alternatively extend crm_campaign_metrics_daily.metadata or add columns for campaign-level breakdown.

No auth, RLS, or sync changes beyond new table and one new column. Recurring, compliance, and contribution logic unchanged.
