# CRM recurring task generation and compliance — audit

**Purpose:** Define how campaign definition fields drive recurring task generation and compliance tracking, without changing auth, RLS, sync, or existing foundations.

---

## 1. Campaign definition → recurring generation

| Definition field | Role in generation |
|------------------|--------------------|
| **weekly_required_posts** | Number of tasks per creator per week with `deliverable_type = 'weekly_post'`. Generator creates up to this many tasks per bundle for the target week, with `due_at` at end of week (or spread). Idempotent: count existing weekly_post tasks in bundle for that week; create only `max(0, weekly_required_posts - count)`. |
| **daily_engagement_required** | When set, generator creates one task per day in the week with `deliverable_type = 'daily_engagement'`, title/description from this field, `due_at` = that day. Idempotent: for each day in week, create only if no daily_engagement task for that bundle with that due_at. |
| **required_platforms** | Optional: when creating weekly_post tasks, can set `platform` (e.g. first platform, or cycle). Does not change count; can be used to assign platform per task. |
| **deliverable_type** (on task) | Each generated task is stored with `deliverable_type` = `weekly_post` or `daily_engagement`. Manual/one-off stay `one_off` or `custom`. Compliance and contribution engine key off this. |

**Scope:** One campaign, one week (configurable start/end). For each task bundle (participant) in that campaign, generator resolves board (creator personal board if exists, else org campaign board), then creates missing tasks. Tasks use `source_type = 'sprint_auto'`, `campaign_id`, `task_bundle_id`, `assigned_to` = participant. No schema change; uses existing `crm_tasks` and `deliverable_type`.

---

## 2. Campaign definition → compliance tracking

Compliance is **computed from existing tasks** (no stored counters). Campaign definition provides the “required” side; tasks provide the “done” side.

| Definition field | Role in compliance |
|------------------|--------------------|
| **weekly_required_posts** | Required number of approved/done weekly posts per creator per week. Compare to count of tasks in bundle with `deliverable_type = 'weekly_post'` and `due_at` in week and `status` in (approved, done). |
| **daily_engagement_required** | Required behavior (text). Compliance: count of tasks with `deliverable_type = 'daily_engagement'` and `due_at` in week and `status` in (approved, done). Can show “N/7 days” for the week. |
| **required_platforms** | For reporting only in this pass; future: “platform coverage” (e.g. approved post per platform). |

**Compliance status (per participant/bundle, for a given week):**

- **Compliant:** Approved weekly posts this week ≥ weekly_required_posts, and daily engagement tasks (if any) met for the week.
- **Behind:** Overdue count > 0, or approved weekly < required, or daily not met.
- **Overperforming:** Approved weekly > required and no overdue.

All derived from `crm_tasks` filtered by `task_bundle_id`, `deliverable_type`, `due_at` in week, and `status`.

---

## 3. Model rules (unchanged)

- **workspace_id** = campaign operator (who runs the campaign).
- **promoted_org_id** = project/client being promoted.
- **promoted_social_handles** = accounts to track for growth/reporting.

Recurring and compliance logic does not change these; they remain for reporting and future contribution/growth.

---

## 4. Bundle and task model (current)

- **crm_task_bundles:** One per (campaign, participant). `expected_task_count` can be updated when we generate (optional).
- **crm_tasks:** `task_bundle_id`, `campaign_id`, `deliverable_type`, `due_at`, `status`. Progress and compliance are computed from these.
- Manual tasks remain; no flattening. Campaign tasks stay linked to bundle and campaign; creator sees “My campaign work” and filters by campaign.

---

## 5. Preparation for contribution engine (next milestone)

- **Completion-based:** Count approved/done tasks per bundle (and optionally by deliverable_type). Contribution % = bundle_completed / total_campaign_completed (or weighted).
- **Weighted by type:** Weights per deliverable_type (e.g. weekly_post = 1, daily_engagement = 0.2). Contribution = sum(weight * approved) / sum(weight * required).
- **Campaign-end %:** Write to `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent` when campaign ends or on-demand.

This pass only prepares the data (deliverable_type, compliance counts); the next pass implements the formulas and writes.
