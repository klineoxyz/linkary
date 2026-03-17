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
- **Worker-ready:** Same `upsertAccountSnapshot` in `@/lib/snapshots` can be called from a cron/worker with the same payload shape (campaign_id, platform, handle, snapshot_type, snapshot_at, metrics).

---

## 3. Finalize campaign flow (implemented)

- **UI:** Campaign detail page shows "Finalize campaign" button when `finalized_at` is null. Confirmation before submit.
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

---

## 6. Export preparation

- **Data shape:** `reportRowsForExport(data: CampaignReportData)` in `@/lib/report.ts` returns `ReportExportRow[]` (section, label, value) for CSV/PDF. Sections: overview, campaign_period, snapshot_totals, growth. No client-only state; straightforward to add download CSV/PDF in a future pass.

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

---

## 8. What should come next

- **CSV/PDF export:** Add "Download CSV" (and optionally PDF) on report page using `reportRowsForExport(data)` and existing report data.
- **Optional end snapshots at finalize:** If desired, finalize flow could call record snapshot (type=end) for each promoted handle with metrics provided in a modal or separate step; currently operator records end snapshots manually before/after finalize.
- **Scheduled snapshot ingestion:** If daily snapshots should be automated, add a worker/cron that reads campaigns with promoted_social_handles and calls an API or internal job to record daily snapshots (metrics would need to come from an external source or manual bulk upload).
