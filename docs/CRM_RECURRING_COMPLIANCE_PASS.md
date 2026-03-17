# CRM recurring task generation + compliance pass — deliverables

**Date:** 2025-03-17  
**Experts:** CRM product architect / campaign ops (lead), Supabase/Postgres/RLS, Next.js App Router, QA/launch-readiness.

---

## 1. Exact files touched

| File | Change |
|------|--------|
| `docs/CRM_RECURRING_AND_COMPLIANCE_AUDIT.md` | **New.** Audit: how campaign definition drives recurring generation and compliance. |
| `apps/crm/src/lib/recurring.ts` | **New.** `getWeekRangeUtc`, `generateRecurringTasksForCampaignWeek`, board resolution per participant (creator vs org). |
| `apps/crm/src/lib/bundles.ts` | `TaskBundleProgressFilter`, `getTaskBundleProgressFiltered`, `progressFromTasks`; `MyCampaignBundleItem` extended with `requiredWeeklyPosts`, `dailyEngagementRequired`, `progressThisWeekWeekly`, `progressThisWeekDaily`; `fetchMyCampaignBundles` fetches definition and this-week progress by type. |
| `apps/crm/src/lib/compliance.ts` | **New.** `getCampaignCompliance(supabase, campaignId)` → compliance rows (participant, weekly approved/required, daily done/total, overdue, status: compliant/behind/overperforming). |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/actions.ts` | `generateRecurringTasksAction(campaignId)` calls `generateRecurringTasksForCampaignWeek`, revalidates campaign and tasks. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/GenerateRecurringTasksButton.tsx` | **New.** Client button to trigger generate action; shows pending and result (tasks created or error). |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` | Fetches `getCampaignCompliance`; “Recurring tasks & compliance” section with Generate button and compliance table (when campaign has weekly/daily definition). |
| `apps/crm/src/app/(dashboard)/tasks/MyCampaignBundles.tsx` | Shows “This week: X/Y weekly posts” and “Daily: N/7 this week” when campaign has required weekly/daily and progress-by-type data. |
| `docs/CRM_RECURRING_COMPLIANCE_PASS.md` | This file. |
| `docs/CRM_CONTRIBUTION_ENGINE_NEXT.md` | **New.** What to build next for contribution engine and reporting. |

---

## 2. Exact recurring/compliance behavior implemented

### Recurring task generation

- **Trigger:** Operator clicks “Generate this week's tasks” on campaign detail (when campaign has `weekly_required_posts` and/or `daily_engagement_required`).
- **Week:** Current week Monday 00:00 UTC → Sunday 23:59 UTC (configurable via `getWeekRangeUtc`).
- **Per bundle (participant):** Resolve board: creator personal board if participant has creator workspace, else org campaign board. Then:
  - **Weekly:** Count existing tasks in bundle with `deliverable_type = 'weekly_post'` and `due_at` in week. Create `max(0, weekly_required_posts - count)` tasks with `deliverable_type = 'weekly_post'`, `due_at` = end of week, `source_type = 'sprint_auto'`, optional `platform` from first `required_platforms`.
  - **Daily:** For each of 7 days in week, if no task in bundle with `deliverable_type = 'daily_engagement'` and `due_at` that day, create one with title “Daily engagement”, description = `daily_engagement_required`.
- **Idempotent:** Re-running creates only missing tasks. No schema change; uses existing `crm_tasks`.

### Compliance tracking

- **Computed** from `crm_tasks` (no stored counters). Current week = same Monday–Sunday UTC.
- **Per participant:** From campaign: `weekly_required_posts`, whether `daily_engagement_required` is set. From tasks: approved+done counts for `weekly_post` and `daily_engagement` in week, plus total overdue for bundle.
- **Status:** `compliant` (weekly met, daily met if required, no overdue); `behind` (overdue or weekly/daily short); `overperforming` (weekly above required, no overdue).

---

## 3. What creators can now see

- **My campaign work (bundles):** Unchanged overall; in addition:
  - When campaign has **required weekly posts:** “This week: X/Y weekly posts” (X = approved+done this week, Y = required).
  - When campaign has **daily engagement:** “Daily: N/7 this week” (N = approved+done daily tasks this week).
- **Required deliverables:** Reflected by campaign definition (weekly_required_posts, daily_engagement_required) and by the tasks they have (weekly_post, daily_engagement).
- **Completed / approved / pending / rejected / overdue:** Already shown; still from bundle progress. No change to manual tasks or task list.

---

## 4. What operators can now see

- **Campaign detail:** New section “Recurring tasks & compliance” when campaign has `weekly_required_posts` or `daily_engagement_required`:
  - **Generate this week's tasks** button: creates missing weekly_post and daily_engagement tasks for all participants; shows “Created N task(s)” or “No new tasks needed” or error.
  - **Compliance table** (current week): Participant, Weekly (approved/required), Daily (done/total), Overdue, Status (compliant / behind / overperforming).
- **Who completed this week’s required posts:** Column “Weekly (approved)” and status.
- **Who completed daily engagement:** Column “Daily (done)” and status.
- **Who is behind / overdue / compliant / overperforming:** Status column and overdue column.

---

## 5. What should come next after this

See **`docs/CRM_CONTRIBUTION_ENGINE_NEXT.md`** for:

- Contribution engine: completion-based and weighted by deliverable_type; write to `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent`.
- Reporting: use promoted_org_id and promoted_social_handles; reward_date, campaign value; no fake metrics.
- Optional: scheduled job to run `generateRecurringTasksForCampaignWeek` for active campaigns each week.

No RLS, auth, or sync changes in this pass. Campaign definition rule (workspace_id = operator, promoted_org_id = promoted, promoted_social_handles = accounts to track) is preserved and used by recurring/compliance only where needed.
