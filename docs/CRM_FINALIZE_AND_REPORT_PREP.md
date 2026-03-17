# CRM — finalize and report preparation

**Context:** Reporting data layer, promoted-account snapshots, and campaign report UI are in place. This doc describes how to add a campaign-end finalize step and use it for reward reporting.

---

## 1. Schema already added

- **crm_campaigns.finalized_at** (timestamptz, nullable): Set when the campaign is finalized. When non-null, contribution can be treated as frozen for reward reporting.
- **crm_campaign_account_snapshots**: Baseline/daily/end snapshots keyed by campaign_id + (platform, handle) from promoted_social_handles. Metrics: followers, views, likes, replies, quotes, reposts, engagement_total.

---

## 2. Finalize step (to implement when needed)

1. **Operator action:** “Finalize campaign” (e.g. button on campaign detail or report).
2. **Server action:**
   - Optionally run contribution with **approved-only** mode (if you add `computeContribution(..., { statuses: ['approved'] })`) and write to `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent` as the “final” share.
   - Set `crm_campaigns.finalized_at = now()`.
   - Optionally record an **end snapshot** for each promoted_social_handles account (so growth is baseline → end).
3. **After finalize:** Report and reward logic can use `finalized_at` to know the campaign is closed and contribution/reward share is from that time.

---

## 3. Approved-only for final share

- **Current:** Contribution uses approved + done (progress).
- **Final/reward:** Use **approved only** so reward share is based on operator-verified work. Add an optional parameter to `computeContribution` / `writeContribution`, e.g. `{ weighted: true, statuses: ['approved'] }`, and when finalizing write that result so it does not get overwritten by later progress recalc. Alternatively keep one contribution_percent and run approved-only only at finalize, then stop recalculating for that campaign (e.g. when finalized_at is set, skip writeContribution updates).

---

## 4. Storing final share safely

- **Option A:** Use existing `contribution_percent` and set `finalized_at` at finalize; from that moment do not run `writeContribution` for that campaign (guard in code: if campaign.finalized_at skip write).
- **Option B:** Add `final_contribution_percent` to bundles/participants and write it once at finalize (approved-only); keep `contribution_percent` for progress. Report uses `final_contribution_percent` when `finalized_at` is set.

Smallest: Option A — finalize sets `finalized_at` and we run one last `writeContribution` with approved-only (when implemented); then UI/code treats finalized campaigns as read-only for contribution.

---

## 5. Summary

| Item | Status |
|------|--------|
| finalized_at column | Added on crm_campaigns |
| Account snapshots table | Added; baseline/daily/end; RLS for workspace |
| Finalize action | Not built; doc describes steps |
| Approved-only contribution | Not built; add as option when implementing finalize |
| Report uses promoted_* | Yes; report shows promoted org and tracked accounts |
