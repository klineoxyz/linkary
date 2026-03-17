# CRM campaign upgrade — gap analysis, schema proposal, implementation plan

This doc audits the current CRM against the target ambassador/community campaign product and defines the path to close gaps without refactoring auth, RLS, sync, or existing working foundations.

---

## 1. Product rule (explicit model)

A campaign may be run by:

- **The project itself** — same entity runs and is promoted.
- **A brand** — brand runs the campaign.
- **A marketing company / agency** — runs the campaign on behalf of another project/client.

Therefore the model must separate:

| Concept | Definition | Current CRM |
|--------|------------|-------------|
| **Campaign operator / owner workspace** | The workspace that runs and manages the campaign in Linkary/CRM. | **Exists:** `crm_campaigns.workspace_id` is the operator workspace (org / project / brand / agency). |
| **Promoted project / target brand** | The project or client being promoted by the campaign. | **Missing.** No FK or identifier for “who is being promoted.” Today we infer from workspace type only. |
| **Promoted social accounts** | The X / YouTube / TikTok (etc.) accounts to track for growth, reporting, mindshare. May belong to the operator or to a third-party client. | **Missing.** No table or FK. CRM only has `platform` (text) on tasks/submissions. Linkary has `social_accounts`; CRM does not reference them. |

**Implication:** Reporting and growth tracking must use **promoted** project/client accounts, not the operator workspace’s own accounts. Today there is no place to attach or select those accounts.

---

## 2. Gap analysis

### 2.1 Campaign definition (Linkary / CRM)

| Target field | Current | Gap |
|--------------|--------|-----|
| Campaign name | `crm_campaigns.title` | OK. |
| Task name / campaign title | Same as title or from sync. | OK for MVP; “task name” can stay as task-level. |
| Start / end date | `starts_at`, `ends_at` | OK. |
| Reward date | — | **Missing.** Add `reward_date`. |
| Campaign value (USD) | `budget`, `currency` | Partial; “value” can map to budget or separate. |
| Token / USDT equivalent | — | **Missing.** Optional token selection or USDT field. |
| Campaign brief | `description` | OK. |
| Required platforms | — | **Missing.** No array/list (X, YouTube, TikTok). Could be JSON or separate table. |
| Campaign operator workspace | `workspace_id` | OK. |
| Promoted project / client | — | **Missing.** Need `promoted_project_*` or FK to org/project. |
| Promoted social account(s) | — | **Missing.** Need link to accounts to track (X handle, etc.). |
| Weekly required original post count | — | **Missing.** |
| Daily engagement requirements | — | **Missing.** |
| Custom deliverables | — | **Partial.** Tasks in bundles; no structured “deliverable type” (daily vs weekly vs one-off). |

### 2.2 Campaign task bundle system

| Target behavior | Current | Gap |
|-----------------|--------|-----|
| One bundle per creator per campaign | `crm_task_bundles` UNIQUE(campaign_id, participant_profile_id). | OK. |
| Bundle groups: daily engagement, weekly post, one-off | Tasks have `source_type` (manual, sprint_auto, org_manual, system). No type for “daily” vs “weekly” vs “one-off”. | **Missing:** task type or deliverable_type. |
| Proof link per task | Submissions linked to task_id; proof URL. | OK. |
| Bundle progress: total / completed / approved / pending / rejected / overdue | DB has `expected_task_count`, `completed_task_count`. `completed_task_count` is **not updated** when tasks change status. No stored pending/rejected/overdue. | **Missing:** progress either computed on read or maintained (e.g. trigger or periodic job). Creator UI does not show bundle-level progress. |

### 2.3 Creator campaign view

| Target | Current | Gap |
|--------|--------|-----|
| See campaigns I’m in | Tasks list shows campaign_title/bundle_title per task. No “my campaigns” list. | **Missing:** “My campaign work” / per-campaign view. |
| Per campaign: name, brief, dates, required deliverables | Campaign detail exists for **org** (campaigns/[id]). Creator has no campaign-scoped view. | **Missing:** creator-facing campaign + bundle view. |
| Task bundle progress % and counts | Not shown. | **Missing:** progress API + UI. |
| Approved / rejected / pending counts | Not aggregated per bundle. | **Missing:** same as progress. |
| Individual contribution % | `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent` exist but are **never set**. | **Missing:** contribution engine (M6). |
| Proof submission history per task | Task detail can show submissions; no per-bundle proof history view. | **Partial:** can be built from submissions. |
| Manual tasks separate | Tasks page mixes campaign and manual; filter “Campaign tasks” exists. | **OK;** need clear separation in UI (e.g. “My campaign work” vs “Manual tasks”). |

### 2.4 Project / org campaign ops view

| Target | Current | Gap |
|--------|--------|-----|
| All campaign participants | Contributors list. | OK. |
| Who completed daily / weekly tasks | No task-type breakdown. | **Missing:** deliverable type + completion by type. |
| Who submitted proof | Submissions table. | OK. |
| Who is late / behind | No “overdue” or “behind” indicator per participant. | **Missing:** per-participant progress vs required. |
| Per-creator contribution % | Not computed or shown. | **Missing:** contribution engine. |
| Per-creator submission stats | Top contributors by submission count. | **Partial;** could add task completion stats. |
| Top contributors | By submission count. | OK. |
| Pending approvals | Submissions with status pending. | OK (submissions list). |
| Campaign status over time | No timeline view. | **Missing:** engagement chart, status over time. |

### 2.5 Reporting and analytics

| Target | Current | Gap |
|--------|--------|-----|
| Budget, duration, reward date | Budget/dates on campaign; no reward_date. | Add reward_date. |
| Total posts, views, likes, replies, quotes, reposts | `crm_campaign_metrics_daily` has total_views, total_engagements, total_posts. No likes/replies/quotes/reposts breakdown. | **Partial;** extend metrics or store in metadata. |
| Contributor count, submissions table | KPIs + submissions table. | OK. |
| Engagement chart over time | No chart. | **Missing:** chart from crm_campaign_metrics_daily. |
| Top contributors | Exists. | OK. |
| Export report | No export. | **Missing.** |
| Stored data only, no fake metrics | KPIs from stored data. | OK. |

### 2.6 Project account growth tracking

| Target | Current | Gap |
|--------|--------|-----|
| Attach promoted project’s X (and other) accounts to campaign | No. | **Missing:** promoted social accounts link. |
| Baseline snapshot at campaign start | No. | **Missing:** snapshot table/store. |
| Daily/periodic snapshots | No. | **Missing.** |
| End snapshot | No. | **Missing.** |
| Follower / engagement / reach / mindshare growth | No. | **Missing:** growth derived from snapshots. |
| Use promoted accounts, not operator’s | N/A (no accounts). | **Missing:** model. |

### 2.7 Contribution engine

| Target | Current | Gap |
|--------|--------|-----|
| Completion-based contribution | Not computed. | **Missing.** |
| Weighted (approved tasks + engagement/views) | Not computed. | **Missing.** |
| Creator contribution % at campaign end | Columns exist; never set. | **Missing:** calculation + write. |
| Operator-side ranking and breakdown | Not shown. | **Missing:** UI + data. |

### 2.8 Multi-platform proof submission

| Target | Current | Gap |
|--------|--------|-----|
| X, YouTube, TikTok, custom links | Submissions have `platform` (text). | OK for storage. |
| Validate and store platform | Normalized in app (x, youtube, tiktok, etc.). | OK. |
| Platform-specific fields extensible | `metrics_snapshot` JSONB. | OK. |

---

## 3. Schema proposal (extensions only)

Preserve all existing tables and RLS. Add only the following.

### 3.1 Campaign: operator, promoted project, promoted accounts

- **Operator workspace:** Already `crm_campaigns.workspace_id`. No change.
- **Promoted project / client (optional):**
  - Add `crm_campaigns.promoted_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL` (Linkary org being promoted), and/or
  - Add `crm_campaigns.promoted_workspace_id uuid REFERENCES public.crm_workspaces(id) ON DELETE SET NULL` if we want to point to another CRM workspace.
  - Recommendation: add `promoted_org_id` only (single source of truth: Linkary org). CRM can resolve display name from Linkary or cache in campaign.
- **Promoted social accounts:**
  - Option A: New table `crm_campaign_promoted_accounts` (campaign_id, platform, handle/url, external_id, sort_order). No FK to Linkary `social_accounts` so CRM stays deployable without DB dependency on web; optional `linkary_social_account_id` later.
  - Option B: Store in `crm_campaigns` as JSONB `promoted_social_handles jsonb DEFAULT '[]'` e.g. `[{ "platform": "x", "handle": "@acme" }, ...]`.
  - Recommendation for minimal change: **Option B** (JSONB) for MVP; migrate to normalized table later if needed.
- **Campaign fields to add:**
  - `reward_date timestamptz`
  - `campaign_value_usd numeric`
  - `token_or_usdt text` (optional)
  - `required_platforms text[]` or `jsonb` (e.g. `["x","youtube","tiktok"]`)
  - `weekly_required_posts int`
  - `daily_engagement_required text` or jsonb (description or structured)
  - `promoted_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL`
  - `promoted_social_handles jsonb DEFAULT '[]'`

### 3.2 Task bundle progress

- **Option A:** Compute on read from `crm_tasks` (count by status, overdue from due_at). No schema change. **Recommendation:** do this first.
- **Option B:** Add columns to `crm_task_bundles`: `approved_count`, `rejected_count`, `pending_count`, `overdue_count`, and maintain via trigger or app when task status changes. Use later if read-compute is too heavy.

### 3.3 Task deliverable type (daily / weekly / one-off)

- Add `crm_tasks.deliverable_type text` CHECK (deliverable_type IN ('one_off', 'weekly_post', 'daily_engagement', 'custom')) DEFAULT 'one_off', nullable for backward compatibility. Sync can set from payload later.

### 3.4 Growth tracking (future milestone)

- New table e.g. `crm_campaign_account_snapshots` (campaign_id, platform, handle_or_id, snapshot_type: baseline | daily | end, snapshot_at, metrics jsonb: followers, views, likes, etc.). Link to campaign; optionally to `promoted_social_handles` by (platform, handle).

### 3.5 Reporting

- Use existing `crm_campaign_metrics_daily` and `crm_campaign_reports`. Add reward_date to campaign; extend `totals` in reports as needed (e.g. likes, replies, reposts) when we have data.

---

## 4. Implementation plan (milestones)

| Milestone | Scope | Deliverables |
|-----------|--------|--------------|
| **M5.5 Campaign bundle model & creator progress** | Bundle progress (computed), creator “My campaign work” view, campaign-scoped task filter. No schema change for progress. | `lib/bundles.ts` (progress + fetch my bundles), tasks page: “My campaign work” section, /tasks?campaign=&lt;id&gt; filter. |
| **M6 Contribution engine** | Compute contribution % (completion-based first; optional weighted). Write to `crm_task_bundles.contribution_percent` and `crm_campaign_participants.contribution_percent`. Show in creator and org views. | Contribution calculation (on task status change or on-demand), update bundles/participants, UI for creator and org. |
| **M7 Reporting upgrade** | Reward date, duration, total posts/views/engagements, submissions table, engagement chart from daily metrics, top contributors, export (CSV/PDF). Stored data only. | Campaign fields (reward_date etc.), report page enhancements, chart, export action. |
| **M8 Promoted accounts & growth tracking** | Campaign: promoted_org_id, promoted_social_handles. Snapshot table, baseline/periodic/end snapshots, growth metrics (follower/engagement/reach). Use promoted accounts in reporting. | Migration for new columns + snapshot table, snapshot jobs or API, growth derivation, report uses promoted accounts. |
| **M9 Campaign definition extension** | required_platforms, weekly_required_posts, daily_engagement_required, campaign_value_usd, token_or_usdt. Task deliverable_type. | Migration, campaign create/edit (org), sync payload extension if needed. |

Order: **M5.5 first** (bundle + creator view), then M6, then M7, then M8/M9 as needed. M9 can run in parallel with M7/M8 if we want structured deliverables and campaign setup first.

---

## 5. Relation to analytics and reporting

- **Operator workspace:** `crm_campaigns.workspace_id` — who runs the campaign; RLS and UI use this for “my campaigns” and access.
- **Promoted project/client:** Once `promoted_org_id` (and optionally `promoted_social_handles`) exist, reporting and growth tracking should:
  - **Attach** metrics and snapshots to the **campaign** (and thus to the promoted project via campaign).
  - **Display** “Promoted: &lt;name&gt;” and “Accounts: @handle1, @handle2” from promoted_social_handles / promoted_org_id.
- **Snapshots:** When we add `crm_campaign_account_snapshots`, each row is tied to campaign_id and to a (platform, handle) that comes from that campaign’s promoted_social_handles (or linked social_accounts later). So analytics and growth are explicitly for the **promoted** accounts, not the operator’s.

---

## 6. Campaign definition extension (M9): data flow and implementation

### 6.1 How the new fields flow

| Layer | Field / concept | Role |
|-------|------------------|------|
| **Operator workspace** | `crm_campaigns.workspace_id` | Unchanged. Who runs and manages the campaign. RLS and “my campaigns” use this. |
| **Promoted project/client** | `crm_campaigns.promoted_org_id` (FK → `public.orgs`) | The Linkary org (project or client) being promoted. Set when operator is agency/brand running on behalf of another; can equal the operator’s linked org when project runs its own campaign. |
| **Promoted social accounts** | `crm_campaigns.promoted_social_handles` (JSONB array of `{ platform, handle }`) | The accounts to use for growth and reporting (e.g. X handle). Must be the promoted project/client’s accounts, not automatically the operator’s. Future snapshots and reports key off this. |
| **Creator bundles** | `crm_task_bundles` unchanged; `crm_tasks.deliverable_type` | Tasks can be typed as one_off, weekly_post, daily_engagement, custom. Sync does not set deliverable_type yet; optional in payload later. |
| **Future reporting** | Campaign detail + `reward_date`, `campaign_value_usd`, `required_platforms`, `weekly_required_posts`, `daily_engagement_required` | Report can show “Promoted: &lt;org&gt;”, “Accounts: …”, reward date, value, and required work. Metrics/snapshots use promoted_social_handles. |

### 6.2 Campaign creation / sync

- **Current sync** (Linkary → CRM): Upserts campaign with `workspace_id`, `source_linkary_campaign_id`, `title`, `status`, `updated_at` only. All new columns are nullable; sync is unchanged and safe.
- **Setting extended fields:** No CRM UI yet to create campaigns; they come from sync. Operator can set promoted_org_id and promoted_social_handles (and other definition fields) via a future campaign edit form or API. Until then, fields can be backfilled or set by an admin/script.

### 6.3 Schema changes (M9 implemented)

- **Migration:** `supabase/migrations/20260412000000_crm_campaign_definition_extension.sql`
  - `crm_campaigns`: reward_date, campaign_value_usd, token_or_usdt, required_platforms (text[]), weekly_required_posts, daily_engagement_required, promoted_org_id (FK orgs), promoted_social_handles (jsonb). Index on promoted_org_id.
  - `crm_tasks`: deliverable_type (text, nullable, CHECK one_off | weekly_post | daily_engagement | custom).

### 6.4 What was implemented now

- Migration applied; types and selects updated in `campaigns.ts` and `tasks.ts`; campaign detail page shows a “Campaign definition” section when any new field is set (reward date, value, token, required platforms, weekly/daily requirements, promoted org, promoted social handles).
- Manual tasks, sync, RLS, bundle view, and existing CRM behavior unchanged.

### 6.5 What becomes possible next

- **Contribution engine (M6):** Can use `required_platforms`, `weekly_required_posts`, and `deliverable_type` to weight or categorize completion.
- **Reporting (M7):** Can show reward_date, campaign value, token, and “Promoted” + “Accounts” from promoted_org_id and promoted_social_handles.
- **Growth tracking (M8):** Snapshot table can key off campaign_id + (platform, handle) from promoted_social_handles; no dependency on operator workspace accounts.
- **Campaign edit UI:** Form to set/update definition fields (including promoted project and promoted social accounts) without changing sync.

---

## 7. Files to touch (M5.5 only — first pass)

- **New:** `apps/crm/src/lib/bundles.ts` — getTaskBundleProgress, fetchMyCampaignBundles.
- **Update:** `apps/crm/src/app/(dashboard)/tasks/page.tsx` — fetch my bundles, pass to new section; support `campaign` query param and filter tasks by campaign_id.
- **Update:** `apps/crm/src/app/(dashboard)/tasks/TasksFilters.tsx` — when campaign param is set, show “Campaign: &lt;name&gt;” and link to clear.
- **New:** `apps/crm/src/app/(dashboard)/tasks/MyCampaignBundles.tsx` — section “My campaign work” with cards (campaign name, brief, dates, progress, link to filter).
- **Update:** `apps/crm/src/lib/tasks.ts` — fetchTasks accepts optional campaignId and filters by campaign_id when provided.

No migration in M5.5; progress is computed from existing `crm_tasks` and `crm_task_bundles`.

**M5.5 first pass implemented:** `apps/crm/src/lib/bundles.ts` (getTaskBundleProgress, fetchMyCampaignBundles), tasks page "My campaign work" section with MyCampaignBundles component, `/tasks?campaign=<id>` filter, TasksFilters campaign pill and clear link.

**M9 campaign definition implemented:** Migration `20260412000000_crm_campaign_definition_extension.sql`; `apps/crm/src/lib/campaigns.ts` (CampaignRow + PromotedSocialHandle, getCampaign/fetchCampaignsForUser select new fields); `apps/crm/src/lib/tasks.ts` (DeliverableType, TaskRow.deliverable_type, select deliverable_type); `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` (Campaign definition section when any new field present). Sync unchanged.
