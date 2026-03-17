# CRM — what comes next: reporting and promoted-account growth tracking

**Context:** Contribution engine is implemented. Campaign definition (workspace_id, promoted_org_id, promoted_social_handles, reward_date, campaign_value_usd, etc.) and task/bundle data are in place. Priority: reporting and growth next, not further contribution changes.

---

## 1. Reporting (aligned with campaign definition)

- **Operator workspace** (`workspace_id`): Who runs the campaign; “my campaigns” and KPIs stay scoped to workspace.
- **Promoted project** (`promoted_org_id`): The project/client being promoted; reports should show “Promoted: &lt;org&gt;” and attach metrics to this.
- **Promoted social accounts** (`promoted_social_handles`): Accounts to use for growth and reach metrics; charts/snapshots should key off these, not the operator’s own accounts.

**Use stored data only:** No fake metrics. Use `crm_campaign_metrics_daily`, `crm_campaign_reports`, campaign fields (reward_date, campaign_value_usd, budget, currency), submission counts, and contribution % already written.

**Possible next steps:**

- Enrich campaign detail report: reward date, campaign value, “Promoted” from promoted_org_id, “Accounts” from promoted_social_handles.
- Charts from `crm_campaign_metrics_daily` (views, engagements over time).
- Export (CSV/PDF) of KPIs and contribution breakdown.

---

## 2. Promoted-account growth tracking

- **Goal:** Track growth of the **promoted** accounts (from `promoted_social_handles`), not the operator’s.
- **Data:** Campaign has `promoted_org_id` and `promoted_social_handles` (array of `{ platform, handle }`). Future snapshots (e.g. `crm_campaign_account_snapshots` or similar) key off campaign_id + (platform, handle).
- **Snapshots:** Baseline at campaign start, optional periodic snapshots, end snapshot. Store followers, engagement, etc. in JSONB or dedicated columns.
- **Growth:** Derive growth from snapshots (e.g. follower delta, engagement delta). Use only stored snapshot data.

No change to auth, RLS, or sync. New tables/jobs should be additive.

---

## 3. Optional: when to recalc contribution

- **Current:** Recalc when operator views campaign and when creator loads /tasks.
- **Later:** On task approval (e.g. in `reviewSubmissionAction` or when task status changes to approved/done), call `writeContribution(supabase, campaignId)` for that task’s campaign so contribution stays up to date without requiring a page load.

---

## 4. Summary

| Next step | Notes |
|-----------|--------|
| Reporting: use promoted_* in UI | Show promoted org and accounts on campaign/report views. |
| Reporting: charts from daily metrics | Use crm_campaign_metrics_daily for time-series. |
| Reporting: export | CSV/PDF of KPIs + contribution. |
| Growth: snapshot table + jobs | Baseline/periodic/end snapshots for promoted_social_handles. |
| Growth: growth metrics | Follower/engagement deltas from snapshots. |
| Optional: recalc contribution on approve | Keep contribution % fresh when tasks are approved. |

Contribution engine is done for this pass; no broad rewrite, manual tasks and existing CRM behavior are preserved.
