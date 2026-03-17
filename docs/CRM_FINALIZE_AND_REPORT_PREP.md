# CRM — finalize and report preparation

**Context:** Reporting data layer, promoted-account snapshots, and campaign report UI are in place. This doc describes the finalize step and snapshot ingestion now implemented.

---

## 1. Schema (already added)

- **crm_campaigns.finalized_at** (timestamptz, nullable): Set when the campaign is finalized. When non-null, contribution is frozen (approved-only final share).
- **crm_campaign_account_snapshots**: Baseline/daily/end snapshots keyed by campaign_id + (platform, handle) from promoted_social_handles. Metrics: followers, views, likes, replies, quotes, reposts, engagement_total.

---

## 2. Snapshot ingestion (implemented)

- **Manual recording:** Report page has "Record snapshot" form. Operator chooses type (baseline / daily / end), optional date, and optional metric fields. One snapshot row is inserted per promoted_social_handles entry with the same metrics and snapshot_at. Stored data only; no fake metrics.
- **API:** `recordSnapshotAction(campaignId, formData)` in `apps/crm/src/app/(dashboard)/campaigns/[id]/actions.ts`. Form fields: `snapshot_type`, `snapshot_at` (optional), `followers`, `views`, `likes`, `replies`, `quotes`, `reposts`, `engagement_total` (all optional).
- **Worker-ready:** `recordSnapshotFromPayloadAction(campaignId, snapshotType, snapshotAt, metrics)` in same actions file. Same effect as the form; accepts explicit params for cron/bulk. RLS: caller must be workspace member. Core logic remains `upsertAccountSnapshot` in `@/lib/snapshots`.

---

## 3. Finalize campaign flow (implemented)

- **UI:** Campaign detail page shows "Finalize campaign" button when `finalized_at` is null. "Record end snapshots" link goes to report. Confirmation before submit.
- **End snapshot safety:** Before finalizing, if the campaign has promoted_social_handles but not all have end snapshots, operator sees a warning: "X/Y promoted accounts have end snapshots. Growth data will be incomplete… Record end snapshots on the report page first, or finalize anyway?" They can cancel and use the link to record, or confirm twice to finalize anyway.
- **Server action:** `finalizeCampaignAction(campaignId)`:
  1. Sets `crm_campaigns.finalized_at = now()` via `setCampaignFinalized`.
  2. Runs `writeContribution(supabase, campaignId, { weighted: true, statuses: ['approved'] })` to write final share to `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent`.
- **Guard:** `writeContribution` skips DB updates for campaigns that already have `finalized_at` when called with default (progress) statuses. Only the finalize run (statuses: ['approved']) writes after finalize; progress recalc no longer overwrites.

---

## 4. Approved-only contribution

- **Options:** `ComputeContributionOptions.statuses?: ('approved'|'done')[]`. Default `['approved','done']` (progress). Use `['approved']` for final/reward share.
- **Report:** When `campaign.finalized_at` is set, `getCampaignReportData` uses `computeContribution(..., { statuses: ['approved'] })` so displayed contribution matches the stored final share.

---

## 5. Reporting trustworthiness

- **Labels:** Report metrics section separates "Campaign-period" (posts, views, engagements from crm_campaign_metrics_daily) and "Promoted-account snapshot totals" (likes, replies, quotes, reposts from end snapshots). Each of likes/replies/quotes/reposts is labeled "end snapshots" and "Promoted-account totals" so it is clear they are not campaign-attributed.
- **Growth:** "Promoted-account growth (baseline → end)" table shows deltas from getAccountGrowth only.
- **Snapshot completeness:** Report shows "End snapshots: X/Y promoted accounts". When campaign is finalized and not all promoted accounts have end snapshots, report shows: "Growth data is partial (not all promoted accounts have end snapshots)." CSV export includes one row "End snapshots (promoted accounts)" with value "X/Y".

---

## 6. Export preparation

- **Data shape:** `reportRowsForExport(data: CampaignReportData)` in `@/lib/report.ts` returns `ReportExportRow[]` (section, label, value). Sections: overview, campaign_period, snapshot_totals, growth, top_contributors, submissions. Labels preserve trust (campaign-period, end snapshots, promoted-account growth, contribution % final share when finalized).
- **CSV export:** Implemented. "Download CSV" on report page calls `getReportCsvAction(campaignId)` (uses same `getCampaignReportData` as report; finalized campaigns get approved-only contribution). Filename: `campaign-report-{id-prefix}-{date}.csv`.

---

## 7. Summary

| Item | Status |
|------|--------|
| finalized_at column | Added on crm_campaigns |
| Account snapshots table | Added; baseline/daily/end; RLS for workspace |
| Snapshot ingestion (manual) | Implemented; form on report page; recordSnapshotAction |
| Finalize action | Implemented; FinalizeCampaignButton + finalizeCampaignAction |
| Approved-only contribution | Implemented; statuses option; write guard for finalized |
| Report uses promoted_* | Yes; report shows promoted org and tracked accounts |
| Report labels (campaign vs snapshot) | Implemented |
| Export-ready shape | reportRowsForExport implemented |
| CSV export | Implemented; Download CSV on report page |
| End snapshot status | getEndSnapshotStatus in snapshots; report + finalize use it |
| Finalize + end snapshot safety | Warn when missing; "Record end snapshots" link; optional finalize anyway |
| Worker-ready snapshot | recordSnapshotFromPayloadAction(campaignId, type, at, metrics) |

---

## 8. What should come next

- **PDF export (optional):** Add "Download PDF" on report page using same report data and export rows if needed; CSV is done.
- **Scheduled snapshot ingestion:** Cron/worker can call `recordSnapshotFromPayloadAction` (with an authenticated client or API route that validates a cron secret). Metrics would need to come from an external source or manual bulk entry; no full external API automation in this pass.
