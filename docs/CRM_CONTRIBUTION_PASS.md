# CRM contribution engine pass — deliverables

**Date:** 2025-03-17  
**Priority:** Contribution engine first; advanced reporting deferred.

---

## 1. Exact files touched

| File | Change |
|------|--------|
| `docs/CRM_CONTRIBUTION_ENGINE_AUDIT.md` | **New.** Formula audit: what counts, completion-based and weighted formulas, where/when it runs, write targets. |
| `apps/crm/src/lib/contribution.ts` | **New.** `DELIVERABLE_WEIGHTS`, `computeContribution(supabase, campaignId, options?)`, `writeContribution(supabase, campaignId, options?)`. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` | Import `writeContribution`; call on load; merge contribution into compliance; add Contribution column and rank (#1, #2…); add standalone Contribution section when campaign has no weekly/daily definition. |
| `apps/crm/src/lib/bundles.ts` | Import `writeContribution`; in `fetchMyCampaignBundles`, call `writeContribution` per campaign and merge into `contributionByBundle`; use for `contributionPercent` on each bundle item. |
| `apps/crm/src/app/(dashboard)/tasks/MyCampaignBundles.tsx` | Show “Your share: X% of campaign” (from `contributionPercent`). |
| `docs/CRM_CONTRIBUTION_PASS.md` | This file. |
| `docs/CRM_REPORTING_AND_GROWTH_NEXT.md` | **New.** What to do next: reporting and promoted-account growth tracking. |

---

## 2. Exact contribution behavior implemented

- **What counts:** Only tasks with `status` in (`approved`, `done`). Rejected, submitted, to_do, in_progress, backlog do not count.
- **Completion-based:** `contribution_percent = 100 * (bundle approved+done count) / (campaign total approved+done)`. Total is sum over all bundles of that campaign.
- **Weighted (used in UI):** Same idea but each task contributes `weight(deliverable_type)`: weekly_post = 1, daily_engagement = 0.25, one_off = 1, custom = 0.5, null/other = 0.5. `contribution_percent = 100 * (bundle weighted sum) / (campaign total weighted)`.
- **Rounding:** One decimal (e.g. 12.5%). Stored as numeric in DB.
- **Write:** On each run, `writeContribution` updates `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent` for that campaign’s bundles/participants.
- **When:** Operator loads campaign detail → `writeContribution(supabase, campaignId, { weighted: true })`. Creator only **reads** `contribution_percent` from DB (no recalc from creator path; see hardening audit).

---

## 3. Formula used

**Weighted (default in this pass):**

- For each bundle B: `weighted_B = Σ weight(deliverable_type)` over tasks in B with status in (`approved`, `done`).
- Weights: `weekly_post` 1, `daily_engagement` 0.25, `one_off` 1, `custom` 0.5, default 0.5.
- `total_weighted = Σ weighted_B` over all bundles of the campaign.
- `contribution_percent_B = total_weighted > 0 ? round(100 * weighted_B / total_weighted, 1) : 0`.

**Completion-based (optional):** Same with all weights = 1 (or call `computeContribution(..., { weighted: false })`).

---

## 4. What creators can now see

- **My campaign work (bundles):** For each campaign they’re in, “Your share: X% of campaign” when contribution is computed (X from `contribution_percent`).
- Contribution is updated when they load /tasks (recalc per campaign and write to DB).

---

## 5. What operators can now see

- **Campaigns with recurring definition:** In “Recurring tasks & compliance”, table has **Contribution** column and rows sorted by contribution (rank #1, #2…). Caption notes “Contribution: weighted by deliverable type (approved/done tasks only).”
- **Campaigns without weekly/daily:** Standalone **Contribution** section with table: #, Participant, Contribution % (sorted by % desc).

---

## 6. What should come next after this

See **`docs/CRM_REPORTING_AND_GROWTH_NEXT.md`**: reporting (use promoted_org_id, promoted_social_handles; reward_date, campaign value; no fake metrics) and promoted-account growth tracking (snapshots, growth from promoted_social_handles).
