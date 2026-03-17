# CRM contribution engine — hardening audit

**Purpose:** Verify contribution under RLS, clarify approved vs done, and make the model safe for reward/final reporting.

---

## 1. Short audit summary

### 1.1 Creator-side writeContribution under RLS

- **Current behavior:** When a creator loads /tasks, `fetchMyCampaignBundles` calls `writeContribution(supabase, campaignId)` for each of their campaigns using the **creator’s** Supabase session.
- **RLS on `crm_task_bundles` (SELECT):** `crm_workspace_member(workspace_id) OR participant_profile_id = crm_current_profile_id()`. A creator in an **org** campaign is not a workspace member of the org; they only see bundles where `participant_profile_id` = themselves. So for each campaign they see **only their own bundle**, not other participants’ bundles.
- **RLS on `crm_tasks` (SELECT):** `crm_workspace_member(workspace_id) OR assigned_to = crm_current_profile_id() OR created_by = crm_current_profile_id()`. The creator sees tasks in their creator workspace (their tasks) and tasks assigned/created by them. They do **not** see other participants’ tasks in the same campaign.
- **Result:** With the creator’s client, `computeContribution` sees only one bundle and only that bundle’s tasks. So `total` = that one bundle’s score, and `contribution_percent` for that bundle becomes **100%**. Recalculating from the creator path therefore **overwrites** correct campaign-wide percentages with **incorrect** (100% for that creator, 0% for everyone else because we only write the one row we computed).
- **Conclusion:** Creator-side contribution recalculation is **wrong and unsafe**. It can produce partial (single-bundle) data and write misleading percentages.

### 1.2 Who can write contribution today?

- **`crm_task_bundles` and `crm_campaign_participants`:** There are **no UPDATE policies** in the current RLS migration. With RLS enabled and no UPDATE policy, Postgres **denies** UPDATE. So today **no** session (operator or creator) can update these rows via the app’s Supabase client; updates affect 0 rows. Contribution writes are effectively **no-ops** unless a service role or a later migration adds UPDATE.
- **Needed:** Allow **workspace members** (operators) to UPDATE `contribution_percent` on bundles/participants for campaigns in their workspace, so that operator-side recalculation actually persists.

### 1.3 Task statuses: approved, done, submitted, rejected

- **approved:** Operator (workspace member) has reviewed and accepted the deliverable. Safe for reward/final reporting.
- **done:** Task marked complete; may be self-marked or workflow state. Not necessarily operator-verified.
- **submitted:** Awaiting operator review. Does **not** count as completed for contribution.
- **rejected:** Operator rejected. Does **not** count.

**Business rule recommendation:**

- **Progress / in-campaign view:** Count **approved + done** so creators and operators see current “share of completed work.” Keeps UX consistent with task completion.
- **Final / reward reporting:** Prefer **approved only** so reward share is based on operator-verified work. If you need a single formula for both, **approved only** is the safest for “campaign-end share”; you can add a separate “progress contribution” (approved+done) later if desired.
- **Current implementation:** Uses **approved + done**. For hardening, we keep that for progress and document that **final/reward reporting should use approved-only** (future option or separate field).

---

## 2. Risk level of current approach

| Risk | Level | Description |
|------|--------|-------------|
| Creator recalc produces wrong % | **High** | Creator sees only their bundle/tasks → total is wrong → their % becomes 100% and would overwrite correct data if writes succeeded. |
| Creator overwrites others’ % | **N/A** | With no UPDATE policies, creator (and operator) writes don’t persist; no overwrite in practice, but also no correct data. |
| Operator recalc correct but not persisted | **High** | Operator has full visibility (all bundles/tasks) so computation is correct, but without UPDATE policies the DB is never updated. |
| Reward reporting on wrong status | **Medium** | Using approved+done is fine for progress; for formal reward share, approved-only is safer and should be documented / optional later. |

**Overall:** Current approach is **not safe** for campaign-end share/reward reporting until: (1) contribution is only recalculated in a context that sees the full campaign (operator/workspace or privileged), and (2) writes are allowed via RLS for that context.

---

## 3. Safest small changes

1. **Stop creator-side recalculation.** Do **not** call `writeContribution` from `fetchMyCampaignBundles`. Creators only **read** `contribution_percent` from `crm_task_bundles` (and campaign_participants as needed). Values are set when an operator views the campaign (or when an explicit “Recalculate” runs in operator context).
2. **Allow operator to write contribution.** Add RLS UPDATE policies so that **workspace members** can update `contribution_percent` on:
   - `crm_task_bundles`: for bundles whose `workspace_id` is a workspace they are a member of (or owner of).
   - `crm_campaign_participants`: for participants in campaigns whose `workspace_id` is a workspace they are a member of.
   - Use the existing `crm_workspace_member(workspace_id)` pattern; for participants we need “campaign in workspace I’m in” → join via `crm_campaigns`.
3. **Document and optionally restrict `writeContribution`.** Document that `writeContribution` must only be called with a Supabase client that has **full campaign visibility** (operator/workspace context). Optionally add a guard: e.g. require that the client can see more than one bundle for the campaign, or only call it from campaign detail (server) and never from creator paths.
4. **Clarify formula and reward use.** In docs: contribution formula counts **approved + done** for progress; for **campaign-end / reward** use **approved only** (future: optional param or separate “final” calculation).

---

## 4. Exact files touched (if changes are made)

| File | Change |
|------|--------|
| `apps/crm/src/lib/bundles.ts` | Remove the loop that calls `writeContribution` in `fetchMyCampaignBundles`. Use only the existing `contribution_percent` from the bundle select (and participant if already joined). |
| `supabase/migrations/20260417000000_crm_contribution_update_policies.sql` | **New.** ADD UPDATE policy on `crm_task_bundles` for workspace members (update rows where `crm_workspace_member(workspace_id)`). ADD UPDATE policy on `crm_campaign_participants` for workspace members (update rows where campaign’s workspace is one they’re a member of). |
| `apps/crm/src/lib/contribution.ts` | Add a short comment that `writeContribution` must only be used in a context with full campaign visibility (e.g. operator viewing campaign). Optionally: add a guard that returns early or logs if `bundles.length` is 0 or 1 and caller is not trusted (we don’t have “caller role” in the function; so we rely on “only call from campaign detail” by convention and docs). |
| `docs/CRM_CONTRIBUTION_ENGINE_AUDIT.md` | State that contribution is **progress** (approved+done); for **final/reward** use **approved only**; and that recalculation must run only in operator/workspace context. |
| `docs/CRM_CONTRIBUTION_HARDENING_AUDIT.md` | This audit (risk, changes, recommendation). |

---

## 5. Formula / logic docs update

- **What counts (current):** Tasks with `status` in (`approved`, `done`). Rejected, submitted, to_do, etc. do not count.
- **Progress contribution (current):** approved + done. Used for in-campaign “share of completed work” and for display on campaign detail and creator bundle view.
- **Final / reward contribution (recommended):** Use **approved only** when computing campaign-end share for rewards or formal reporting. Implementation: either a separate `computeContribution(..., { statuses: ['approved'] })` in the future or a “Finalize contribution” action that writes using approved-only and stores in the same (or a dedicated) column.
- **Where it runs:** Server-side, in the CRM app. **Only in a context that can see all bundles and all tasks for the campaign** — i.e. when an **operator** (workspace member) loads campaign detail or triggers “Recalculate contribution.” Never run from the creator /tasks path.
- **When it updates:** When operator loads campaign detail (and optionally on “Recalculate contribution” or when a task is approved, in a future pass).

---

## 6. Final recommendation: is contribution good enough for campaign-end share / reward reporting?

- **After the hardening above:** **Yes, with one nuance.**
  - **Progress share (approved+done):** Safe for in-campaign display and for “current share of completed work” once recalc runs only in operator context and writes are allowed by RLS.
  - **Campaign-end / reward share:** The **same** percentage can be used for reward reporting **if** you treat “approved + done” as the definition of completed work. If you need “operator-verified only,” add an **approved-only** mode (e.g. option or separate finalize step) and use that for the final snapshot. The data model (contribution_percent on bundles and participants) is suitable for both; the formula (approved vs approved+done) is the only choice to document and optionally parameterize.

**Summary:** Harden by (1) removing creator-side write, (2) adding RLS UPDATE for workspace members, (3) documenting operator-only recalc and approved vs approved+done. After that, contribution is safe and suitable to power campaign-end share and reward reporting, with the option to add an approved-only final calculation later if required.

---

## 7. Exact files touched (hardening pass)

| File | Change |
|------|--------|
| `docs/CRM_CONTRIBUTION_HARDENING_AUDIT.md` | **New.** This audit (risk, RLS, approved vs done, safest changes, recommendation). |
| `apps/crm/src/lib/bundles.ts` | Remove `writeContribution` import and loop; creator only reads `contribution_percent` from bundle select. |
| `supabase/migrations/20260417000000_crm_contribution_update_policies.sql` | **New.** UPDATE policies on `crm_task_bundles` and `crm_campaign_participants` for workspace members. |
| `apps/crm/src/lib/contribution.ts` | Comment: writeContribution only in operator context; do not call from creator path. Note on approved-only for final/reward. |
| `docs/CRM_CONTRIBUTION_ENGINE_AUDIT.md` | Where/when: operator only; creator reads only. Add “Progress vs final/reward” and summary row for RLS. |
| `docs/CRM_CONTRIBUTION_PASS.md` | When: creator only reads (no recalc). |
