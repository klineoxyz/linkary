# CRM — what comes next: contribution engine and reporting

**Context:** Recurring task generation and compliance tracking are in place. Campaign definition (workspace_id, promoted_org_id, promoted_social_handles, weekly_required_posts, daily_engagement_required, etc.) and deliverable_type on tasks are the inputs for the next milestone.

---

## 1. Contribution engine (next milestone)

**Goal:** Compute and store contribution % per creator per campaign so operators and creators can see “your share” and rankings.

### Data already available

- **Per bundle:** Tasks with `deliverable_type` (weekly_post, daily_engagement, one_off, custom) and `status` (approved, done, rejected, etc.).
- **Per campaign:** `weekly_required_posts`, `daily_engagement_required` (definition).
- **Compliance:** Approved/done counts per type per week (computed in this pass).

### Completion-based contribution

- **Formula (simple):** For a campaign, total_approved = sum over all bundles of (approved + done) task count. For each bundle, contribution_percent = 100 * (bundle_approved + bundle_done) / total_approved (when total_approved > 0).
- **Where to write:** `crm_task_bundles.contribution_percent`, optionally `crm_campaign_participants.contribution_percent`.
- **When to run:** On campaign end, or on-demand when viewing campaign, or when task status changes (e.g. approved) — start with on-demand or nightly for simplicity.

### Weighted contribution by task type

- **Weights (example):** weekly_post = 1, daily_engagement = 0.2, one_off = 1, custom = 0.5.
- **Formula:** For each bundle, weighted_done = sum(weight(deliverable_type) for each approved/done task). Campaign total = sum over bundles. contribution_percent = 100 * bundle_weighted_done / campaign_total_weighted_done.
- **Preparation:** This pass already has deliverable_type on tasks and compliance counts by type; the next pass only needs to apply weights and write %.

### Campaign-end contribution %

- **Use case:** Final “share” for rewards or reporting. Same formulas; run when campaign status → completed (or on a “Finalize contribution” action).
- **Storage:** `crm_task_bundles.contribution_percent`, `crm_campaign_participants.contribution_percent` (already in schema).

### Guardrails

- No fake metrics; use only stored task statuses and campaign definition.
- Preserve RLS; computation can run server-side with caller’s Supabase client (workspace member sees only their campaign’s data).

---

## 2. Reporting (aligned with campaign definition)

- **Operator workspace** (`workspace_id`): Who runs the campaign; reporting and KPIs are for “my campaigns.”
- **Promoted project** (`promoted_org_id`): The project/client being promoted; show “Promoted: &lt;org&gt;” and attach growth/reporting to this.
- **Promoted social accounts** (`promoted_social_handles`): Accounts to track for growth; future snapshots and charts key off these, not the operator’s own accounts.

Reporting and contribution engine do not change these rules; they consume them.

---

## 3. Optional: scheduled recurring generation

- **Cron or worker:** Each week (e.g. Monday 00:00 UTC), for each campaign that is active and has `weekly_required_posts` or `daily_engagement_required`, call `generateRecurringTasksForCampaignWeek(supabase, campaignId)` (with service or workspace-scoped client as appropriate).
- **Idempotent:** Already safe to run multiple times; only missing tasks are created.

---

## 4. Summary

| Next step | Owner | Notes |
|-----------|--------|--------|
| Contribution % (completion-based) | CRM product / backend | Read tasks by bundle, compute %, write to bundle + participant. |
| Contribution % (weighted by type) | CRM product / backend | Same + weight by deliverable_type. |
| Campaign-end finalize | CRM product | Trigger on status=completed or explicit action. |
| Reporting uses promoted_* | Reporting / growth | Use promoted_org_id and promoted_social_handles in reports and snapshots. |
| Weekly cron for recurring tasks | DevOps / backend | Optional; call generateRecurringTasksForCampaignWeek for active campaigns. |

This pass did not implement the contribution formulas or write to contribution_percent; it only prepared the data (deliverable_type, compliance, progress by type) so the next pass can do so without refactoring.
