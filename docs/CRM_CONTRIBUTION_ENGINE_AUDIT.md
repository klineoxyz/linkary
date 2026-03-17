# CRM contribution engine — formula and data audit

**Purpose:** Define a transparent, repeatable contribution scoring model using only stored task and bundle data. No fake metrics; no change to auth, RLS, or sync.

---

## 1. Data used (stored only)

| Source | What counts |
|--------|-------------|
| **crm_tasks** | Tasks in the campaign (via task_bundle_id → crm_task_bundles → campaign_id). Only tasks with `status` in (`approved`, `done`) count. Rejected, submitted, to_do, etc. do not count. |
| **deliverable_type** | Optional weight per task: weekly_post, daily_engagement, one_off, custom. Used only in weighted mode. |
| **crm_task_bundles** | One row per (campaign_id, participant_profile_id). Contribution % is written to `contribution_percent`. |
| **crm_campaign_participants** | One row per (campaign_id, participant_profile_id). Contribution % is written to `contribution_percent` (same value as bundle for that participant). |
| **Campaign definition** | Not used in the formula; compliance uses it. Contribution is purely “share of completed work.” |

**What does not count:** Rejected tasks, submitted (pending review), to_do, in_progress, backlog. Only **approved** and **done** tasks.

---

## 2. Formula

### Completion-based (default)

- For campaign C, take all bundles for C.
- For each bundle B: **count_B** = number of tasks in B with status in (`approved`, `done`).
- **total** = sum of count_B over all bundles of C.
- For each bundle B: **contribution_percent_B** = total > 0 ? round(100 * count_B / total) : 0.
- If total is 0, every bundle gets 0% (or we leave existing value / set null). We set 0 for consistency.

### Weighted by deliverable_type (optional)

- **Weights (fixed):** weekly_post = 1, daily_engagement = 0.25, one_off = 1, custom = 0.5. Null/unknown = 0.5.
- For each bundle B: **weighted_B** = sum over tasks in B with status in (`approved`, `done`) of weight(deliverable_type).
- **total_weighted** = sum of weighted_B over all bundles of C.
- For each bundle B: **contribution_percent_B** = total_weighted > 0 ? round(100 * weighted_B / total_weighted) : 0.

Rounding: round to 1 decimal or integer. We use one decimal (e.g. 12.5%) for transparency; stored in DB as numeric.

---

## 3. Where it runs

- **Server-side only**, in the CRM app (e.g. `apps/crm/src/lib/contribution.ts`).
- Uses the same Supabase client as the request (RLS applies; workspace member only sees their campaign’s data).
- No cron required for MVP; can be triggered on-demand.

---

## 4. When it updates

- **Operator:** When loading campaign detail page for a campaign, run compute + write for that campaign so the compliance/contribution table shows current % and rank.
- **Creator:** When loading /tasks (My campaign work), run compute + write for each campaign the creator is in (so `contribution_percent` on their bundles is up to date). Alternatively, only update when operator views campaign; creator then sees last-written value (simpler, slightly staler). We choose: **update when operator views campaign** and **when creator loads /tasks** (update for each of their campaigns) so both see fresh data.
- **Optional later:** When a task status changes to approved/done, trigger recalc for that campaign (e.g. from review action).

---

## 5. Write targets

- **crm_task_bundles.contribution_percent** — one row per bundle; set to contribution_percent_B.
- **crm_campaign_participants.contribution_percent** — one row per participant; set to same % as that participant’s bundle (participant has exactly one bundle per campaign).

Updates are by id (bundle) and by (campaign_id, participant_profile_id) for participants. Safe and idempotent.

---

## 6. Summary

| Item | Choice |
|------|--------|
| What counts | Approved + done tasks only |
| Completion-based | contribution_percent = 100 * (bundle approved+done count) / (campaign total approved+done) |
| Weighted | contribution_percent = 100 * (bundle weighted sum) / (campaign total weighted); weights by deliverable_type |
| Where | Server, lib/contribution.ts |
| When | Campaign detail load (operator), /tasks load (creator’s campaigns) |
| Write | crm_task_bundles.contribution_percent, crm_campaign_participants.contribution_percent |
