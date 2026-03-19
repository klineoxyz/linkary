# Campaign-definition wiring pass

## 1. Audit summary

### What existed already

- **Jobs schema (Linkary)** — `jobs` table had `objective`, `links`; migration `20260422000000` added `promoted_org_id`, `required_platforms`, `promoted_social_handles`, `weekly_required_posts`, `daily_engagement_required`. These columns were not used in create/edit or sync.
- **CRM campaigns schema** — `crm_campaigns` had `required_platforms`, `weekly_required_posts`, `daily_engagement_required`, `promoted_org_id`, `promoted_social_handles` (from prior migration). No `campaign_objective` or `guidance_links` columns.
- **Linkary create job API** — Accepted `type`, `title`, `budget`, `duration`, `tags`, `description`, `apply_url`, `objective`, `links` only.
- **Accept application flow** — Fetched job `id`, `org_id`, `status`, `title` and called `triggerLinkaryCrmSync` with minimal payload (no campaign-definition fields).
- **CRM sync** — `runLinkarySync` upserted campaign with `title`, `status` only; no objective, links, platforms, handles, or cadence.
- **CRM campaign detail** — Already displayed `required_platforms`, `weekly_required_posts`, `daily_engagement_required`, `promoted_org_id`, `promoted_social_handles`. Did not show objective or guidance links.
- **CRM task detail** — Showed campaign title and bundle title only; no campaign context (objective, links, platforms, handles, cadence) for creators.

### What was missing

- Linkary job/sprint create form did not collect: promoted org, required platforms, promoted social handles, weekly posts, daily engagement (only objective and links existed for sprints).
- Sync payload and CRM sync did not pass or store campaign-definition fields on `crm_campaigns`.
- CRM campaigns had no columns for objective or guidance links from Linkary.
- Creators saw no campaign context on task detail (objective, guidance links, platforms, handles, cadence).
- Org reviewers did not see objective or guidance links on campaign detail.

### What was changed

1. **Migration** — `20260423000000_crm_campaigns_objective_guidance.sql`: added `campaign_objective` (text) and `guidance_links` (jsonb) to `crm_campaigns`.
2. **Linkary jobs API** — POST body now accepts and persists `promoted_org_id`, `required_platforms`, `promoted_social_handles`, `weekly_required_posts`, `daily_engagement_required`. GET returns these. Links capped at 5 in API.
3. **Linkary job/sprint form (OrgDetailPage)** — For type "sprint", added: promoted org ID (optional), required platforms (comma/token list), promoted social handles (lines "platform handle"), weekly required posts (number), daily engagement (text). Guidance links placeholder updated to "up to 5"; parsing still produces up to 5 links.
4. **Linkary sync payload** — `LinkarySyncPayload` now includes optional `campaign_definition`: `objective`, `links`, `promoted_org_id`, `required_platforms`, `promoted_social_handles`, `weekly_required_posts`, `daily_engagement_required`.
5. **Accept application route** — Fetches full job fields (including campaign-definition columns) and builds `campaign_definition` from job when present; passes it to `triggerLinkaryCrmSync`.
6. **CRM sync** — `runLinkarySync` reads `campaign_definition` and upserts `crm_campaigns` with `campaign_objective`, `guidance_links`, `promoted_org_id`, `required_platforms`, `promoted_social_handles`, `weekly_required_posts`, `daily_engagement_required` when provided.
7. **CRM campaigns lib** — `CampaignRow` and selects include `campaign_objective`, `guidance_links`.
8. **CRM campaign detail page** — Campaign definition section now shows objective and guidance links (and already showed other definition fields).
9. **CRM task detail page** — When task has `campaign_id`, fetches campaign via `getCampaign` and renders a "Campaign context" block for creators: objective, platforms, weekly posts, daily engagement, promoted handles, guidance links.

---

## 2. Exact files touched

| File | Change |
|------|--------|
| `supabase/migrations/20260423000000_crm_campaigns_objective_guidance.sql` | **New.** Add `campaign_objective`, `guidance_links` to `crm_campaigns`. |
| `apps/web/src/lib/jobs.ts` | Extended `Job` type with campaign-definition fields. |
| `apps/web/src/app/api/orgs/[orgId]/jobs/route.ts` | GET select and POST body/insert extended for new job fields; links capped at 5. |
| `apps/web/src/lib/crm-sync.ts` | `LinkarySyncPayload` extended with optional `campaign_definition`. |
| `apps/web/src/app/api/applications/[id]/accept/route.ts` | Job select and sync call extended to pass `campaign_definition` from job. |
| `apps/web/src/figma/app/components/OrgDetailPage.tsx` | New state and form fields for sprint: promoted org ID, platforms, handles, weekly posts, daily engagement; payload and reset updated. |
| `apps/crm/src/lib/sync.ts` | `LinkarySyncPayload` type and `runLinkarySync` upsert extended to read/write campaign-definition fields on `crm_campaigns`. |
| `apps/crm/src/lib/campaigns.ts` | `CampaignRow` and select lists extended with `campaign_objective`, `guidance_links`. |
| `apps/crm/src/app/(dashboard)/tasks/[id]/page.tsx` | Fetch campaign when task has `campaign_id`; render "Campaign context" block for creators. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` | Campaign definition section shows `campaign_objective` and `guidance_links`. |
| `docs/CAMPAIGN_DEFINITION_WIRING_PASS.md` | This file. |

---

## 3. Migrations required

- **`20260423000000_crm_campaigns_objective_guidance.sql`** — Adds `campaign_objective` (text) and `guidance_links` (jsonb) to `crm_campaigns`. Run with `supabase db push` or SQL editor.

Existing migrations assumed already applied: `20260422000000_jobs_campaign_definition_fields.sql` (jobs), `20260412000000_crm_campaign_definition_extension.sql` (crm_campaigns extension).

---

## 4. Sync / API contract changes

- **Linkary `POST /api/orgs/[orgId]/jobs`** — Request body may now include: `promoted_org_id` (string), `required_platforms` (string[]), `promoted_social_handles` (array of `{ platform, handle }`), `weekly_required_posts` (number), `daily_engagement_required` (string). Response includes these.
- **Linkary → CRM sync payload** — Optional `campaign_definition`: `{ objective?, links?, promoted_org_id?, required_platforms?, promoted_social_handles?, weekly_required_posts?, daily_engagement_required? }`. CRM API still accepts payload without it (backward compatible).

---

## 5. Form fields now available on Linkary jobs

For **sprint** type only (in Create job modal):

- **Existing:** Title, duration, budget, objective (textarea), guidance links (up to 5; one per line: Label URL or URL).
- **New:**  
  - Promoted org ID (optional; client/partner org UUID).  
  - Required platforms (e.g. `x, youtube, tiktok`).  
  - Promoted social handles (one per line: `platform handle`, e.g. `x @client`).  
  - Weekly required posts per creator (number).  
  - Daily engagement requirement (text).

For **job** type: unchanged (description, apply URL, tags).

---

## 6. What creators now see in CRM

On **task detail** (`/tasks/[id]`) for a task linked to a campaign:

- **Campaign context** section when the campaign has any of: objective, guidance links, required platforms, promoted handles, weekly posts, daily engagement.
- Displayed: objective, platforms, weekly posts expected, daily engagement, accounts to promote (list), and guidance links (clickable).

---

## 7. What org reviewers now see in CRM

On **campaign detail** (`/campaigns/[id]`):

- **Campaign definition** section already showed: reward date, campaign value, token/USDT, required platforms, weekly required posts, daily engagement, promoted project (org id), promoted social accounts.
- **New:** Objective (text) and Guidance links for creators (list of labeled links).

---

## 8. QA checklist for the full flow

- [ ] Create a sprint on Linkary with: title, objective, up to 5 guidance links, promoted org ID (optional), required platforms, promoted handles, weekly posts, daily engagement.
- [ ] Accept an application for that job.
- [ ] In CRM, open the synced campaign; confirm campaign definition shows objective, guidance links, platforms, handles, weekly posts, daily engagement.
- [ ] As creator, open a task under that campaign; confirm "Campaign context" shows objective, platforms, weekly posts, daily engagement, promoted handles, guidance links.
- [ ] Confirm existing task submission and review flow still works.
- [ ] Create a job (non-sprint) on Linkary; confirm no new fields are required and behavior unchanged.
- [ ] Accept application for a job/sprint that has no campaign-definition fields; confirm sync still succeeds and CRM campaign shows without errors.

---

## 9. Regression checklist

- [ ] Onboarding untouched.
- [ ] Referrals untouched.
- [ ] Org authority from `org_members` untouched.
- [ ] Analytics stored-data-only model untouched.
- [ ] Active context untouched.
- [ ] CRM creator bootstrap (/tasks) still works.
- [ ] CRM org workspace bootstrap (/campaigns) still works.
- [ ] Linkary org route and org insights still work.

---

## 10. Final verdict

- **Is campaign-definition now actually connected end-to-end?**  
  Yes. Linkary sprint create form collects campaign-definition fields; they are stored on `jobs`; accept-application sends them in the sync payload; CRM sync writes them to `crm_campaigns`; creators see campaign context on task detail; org reviewers see full definition including objective and guidance links on campaign detail.

- **Exact gaps remaining, if any?**  
  - **Promoted org ID** on the form is a free-text UUID; no dropdown of “other orgs you admin” in this pass (could be a later UX improvement).  
  - **Task generation** from campaign (e.g. auto-creating N tasks from weekly posts) is unchanged; cadence is displayed but not used to auto-generate recurring tasks in this pass.  
  - **CampaignDefinitionForm** in CRM (edit definition) was not extended to edit `campaign_objective` or `guidance_links`; they are set from Linkary sync only.
