# CRM workspace bootstrap hardening + campaign definition management pass

**Date:** 2025-03-17  
**Priority order:** (1) Launch-critical workspace bootstrap, (2) Operator-facing campaign definition management, (3) Deliverable prep. Order preserved.

---

## 1. Which experts handled which part

| Part | Lead | Support |
|------|------|--------|
| **Part 1 — Workspace bootstrap hardening** | Supabase/Postgres/RLS expert | Next.js SSR auth/session, QA/launch-readiness |
| **Part 2 — Campaign definition management** | CRM product architect / campaign ops | Frontend UX, Next.js |
| **Part 3 — Deliverable preparation** | CRM product architect | — |
| **Guardrails & verification** | QA / launch-readiness | All |

---

## 2. Short root-cause summary for /tasks workspace issue

- **Observed:** Some users see “No workspace yet” in one place and “Could not create your workspace. Try signing out and back in…” on `/tasks`.
- **Root causes addressed:**
  1. **Duplicate slug (race):** Two concurrent requests (or double-submit) could both try to insert the same creator workspace (`creator-${profileId.slice(0,8)}`). The second insert fails with Postgres `23505` (unique_violation). The flow did not recover and surfaced a generic error.
  2. **Missing profile:** If the authenticated user had no `public.profiles` row, the app could still call `getOrCreateCreatorWorkspaceAndBoard` after passing `canBootstrapCreatorWorkspace` in a narrow race, or the UI showed “no access” instead of the clearer “Your account isn’t set up for Tasks yet” with a hint to sign in on linkary.xyz first.
  3. **Order of checks:** The page now checks for “no profile” **before** attempting bootstrap when the user has no creator workspace, so missing-profile users consistently see the actionable no_profile message instead of a generic failure.
- **Not changed (per guardrails):** RLS design, auth/session design, cookie domain behavior. Sync and task actions were already gated on workspace result and remain unchanged.

---

## 3. Exact files touched

| File | Change |
|------|--------|
| `apps/crm/src/lib/workspace.ts` | Handle workspace insert `23505` by re-selecting existing workspace; ignore member insert `23505` when already member. |
| `apps/crm/src/app/(dashboard)/tasks/page.tsx` | When user has no creator workspace, check for missing profile first and show no_profile message; then check profile_type for no-access; then call getOrCreate. Removed unused `canBootstrapCreatorWorkspace` import; use `CREATOR_BOOTSTRAP_PROFILE_TYPE`. |
| `apps/crm/src/lib/campaigns.ts` | Added `UpdateCampaignDefinitionPayload`, `updateCampaignDefinition()`. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/actions.ts` | Added `updateCampaignDefinitionAction(campaignId, formData)`. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/CampaignDefinitionForm.tsx` | **New.** Client form for editing campaign definition (operator / promoted / accounts / rewards / requirements). |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` | Fetch workspace slug; add “Campaign definition” section with read-only summary and “Edit definition” form. |
| `apps/crm/src/lib/tasks.ts` | `createTask`: optional `campaign_id`, `task_bundle_id`, `deliverable_type`. `updateTask`: optional `deliverable_type`. |
| `docs/CRM_TASKS_WORKSPACE_BOOTSTRAP.md` | (Optional) reference this pass. |
| `docs/CRM_BOOTSTRAP_AND_CAMPAIGN_DEFINITION_PASS.md` | **New.** This deliverables doc. |

---

## 4. Exact fixes for workspace bootstrap

1. **`workspace.ts` — Duplicate slug (23505):**
   - On workspace insert error with code `23505`, re-select `crm_workspaces` by `owner_profile_id` + `type = 'creator'` and use that workspace id.
   - If no row found after 23505, log and return `workspace_insert`.
   - When inserting `crm_workspace_members`, ignore error with code `23505` (already a member, e.g. race).

2. **`tasks/page.tsx` — Clear no-profile and no-access flow:**
   - When the user has no creator workspace: first query `profiles` for `user.id`.
   - If no profile row → show “Your account isn’t set up for Tasks yet.” and hint (sign in on linkary.xyz first).
   - If profile exists but `profile_type !== 'individual'` → show TasksNoAccess (no personal task board).
   - Otherwise → call `getOrCreateCreatorWorkspaceAndBoard(supabase, user.id)` and surface its error message if it fails.

3. **Observability:** Existing `[CRM tasks]` bootstrap failure logging unchanged; 23505 is logged only when re-select fails (`no_race_row`).

---

## 5. Exact UI/API/schema flow for campaign definition management

- **Schema (unchanged):** `crm_campaigns` already has `reward_date`, `campaign_value_usd`, `token_or_usdt`, `required_platforms`, `weekly_required_posts`, `daily_engagement_required`, `promoted_org_id`, `promoted_social_handles`. `workspace_id` remains the operator; no schema migration in this pass.
- **API:**
  - `updateCampaignDefinition(supabase, campaignId, payload)` in `lib/campaigns.ts`: updates only these definition fields; RLS enforces workspace membership.
  - `updateCampaignDefinitionAction(campaignId, formData)` in `campaigns/[id]/actions.ts`: parses form (dates, numbers, comma-separated platforms, newline-separated “platform, handle” for promoted_social_handles) and calls `updateCampaignDefinition`; revalidates campaign path.
- **UI:**
  - Campaign detail page (`campaigns/[id]/page.tsx`): “Campaign definition” section explains operator vs promoted vs accounts; shows read-only summary when any definition field is set; “Edit definition” subsection with `CampaignDefinitionForm`.
  - Form labels make the product rule explicit: “Who runs this campaign” (this workspace, read-only); “Promoted project / client (Linkary org ID)”; “Accounts to track for reporting (one per line: platform, handle)”; plus reward date, campaign value USD, token/USDT, required platforms, weekly required posts, daily engagement required.
- **Sync:** Unchanged; sync does not populate definition fields. Operators set them in CRM.

---

## 6. What operators can do after this pass

- Open a campaign (org workspace member) and use **Edit definition** to set or update:
  - **Promoted project:** Linkary org ID (who is promoted).
  - **Accounts to track:** One line per “platform, handle” for reporting/growth.
  - **Reward date,** **Campaign value (USD),** **Token/USDT.**
  - **Required platforms** (comma-separated), **Weekly required posts**, **Daily engagement required.**
- See a clear distinction between who runs the campaign (workspace), who is promoted (promoted_org_id), and which accounts are tracked (promoted_social_handles).
- Creator bundle view, sync, and existing CRM behavior are unchanged.

---

## 7. What should come next

- **Launch:** Rely on hardened /tasks bootstrap and verification checklist in `CRM_TASKS_WORKSPACE_BOOTSTRAP.md` (valid individual, missing profile, org user, shared-auth).
- **Campaign definition:** Optionally backfill or extend sync later to set definition fields from Linkary when available; keep operator edit as source of truth where needed.
- **Recurring task engine:** When building it, use `required_platforms`, `weekly_required_posts`, `daily_engagement_required`, `deliverable_type`, `promoted_org_id`, `promoted_social_handles`; task create/update already accept optional `deliverable_type`, `campaign_id`, `task_bundle_id`.
- **Reporting/growth:** Use promoted project and promoted_social_handles for reporting and growth tracking; no changes required in this pass.

---

## 8. Final note: safer and more usable for controlled rollout

- **Bootstrap:** Duplicate-slug races are handled without showing a generic error; missing-profile users get an actionable message; org/company users still get no-access. No RLS or auth redesign; minimal, targeted changes.
- **Campaign definition:** Operators can manage definition fields in one place with explicit operator vs promoted vs accounts; schema and sync are unchanged; future contribution and reporting can rely on these fields and on task `deliverable_type`.
- **Guardrails respected:** No broad rewrite; apps/web unchanged; manual tasks and creator bundle view preserved; sync and role-aware access unchanged. The CRM is in a better state for a controlled rollout.
