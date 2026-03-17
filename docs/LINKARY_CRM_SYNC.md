# Linkary → CRM sync contract

Idempotent sync from Linkary (sprint/gig acceptance) into CRM: campaign, participant, task bundle, and tasks. Duplicate or concurrent triggers do not duplicate records. Failures are logged for recovery.

---

## 1. Endpoint

- **URL:** `POST {CRM_APP_URL}/api/sync/linkary` (e.g. `https://crm.linkary.xyz/api/sync/linkary`)
- **Auth:** Header `Authorization: Bearer <CRM_SYNC_SECRET>` or `X-CRM-Sync-Secret: <CRM_SYNC_SECRET>`
- **Body:** JSON payload (see below).

---

## 2. Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspace_id` | string (UUID) | One of these | CRM workspace id (org/project/brand/agency). Use when you already have it. |
| `org_id` | string (UUID) | One of these | **Linkary org id.** CRM resolves workspace via `crm_workspaces.linked_org_id`. Prefer this for job/sprint acceptance. |
| `source_linkary_campaign_id` | string | Yes | Linkary campaign/sprint/job identifier. Used for idempotent campaign upsert. |
| `campaign_title` | string | No | Campaign title; applied on create and on subsequent sync (upsert). |
| `participant_profile_id` | string (UUID) | Yes | `profiles.id` of the creator who accepted. |
| `tasks` | array | Yes | At least one task. Each item: see below. |

**Task item:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `linkary_task_id` | string | Yes | Unique id for this task in Linkary. Stored in `crm_tasks.linkary_task_id` for idempotency. |
| `title` | string | Yes | Task title. |
| `description` | string | No | Optional. |
| `platform` | string | No | Optional. |

**Example:**

```json
{
  "workspace_id": "uuid-of-crm-org-workspace",
  "source_linkary_campaign_id": "sprint-123",
  "campaign_title": "Q1 Creator Sprint",
  "participant_profile_id": "uuid-of-creator-profile",
  "tasks": [
    { "linkary_task_id": "deliverable-1", "title": "Post 1", "platform": "x" },
    { "linkary_task_id": "deliverable-2", "title": "Post 2" }
  ]
}
```

---

## 3. Idempotency (code and database)

Idempotency is enforced in code and at the database level so concurrent duplicate sync calls are safe.

| Entity | Uniqueness (DB) | Behavior |
|--------|-----------------|----------|
| Campaign | `UNIQUE(workspace_id, source_linkary_campaign_id)` | Upsert; existing campaign is updated (e.g. title). |
| Participant | `UNIQUE(campaign_id, participant_profile_id)` | Upsert; insert only if not present. |
| Task bundle | `UNIQUE(campaign_id, participant_profile_id)` | Upsert; one bundle per participant per campaign. |
| Task | `UNIQUE(task_bundle_id, linkary_task_id)` + column `crm_tasks.linkary_task_id` | Insert; duplicate key is ignored (no duplicate task). |

Repeated or concurrent POSTs with the same payload do not create duplicate campaigns, participants, bundles, or tasks.

---

## 4. Org → CRM workspace mapping

**Source of truth:** `crm_workspaces.linked_org_id` (references Linkary `orgs.id`). When you create an org workspace in CRM, set `linked_org_id` to the Linkary org id so sync can resolve it. A unique constraint ensures at most one org/project/brand/agency workspace per Linkary org.

- **Using `org_id` in payload:** Pass Linkary `orgs.id`. CRM resolves `workspace_id` by selecting the CRM workspace where `linked_org_id = org_id` and type is org/project/brand/agency. If none exists, sync returns a clear error: "No CRM workspace linked to this org".
- **Using `workspace_id` in payload:** Use when you already have the CRM workspace id (e.g. from another flow).
- **Backfill / verification:** See `docs/CRM_PRE_LAUNCH_VERIFICATION.md` for auditing and backfilling `linked_org_id` on existing org-style workspaces.

---

## 5. Creator task visibility

- **Eligible creators (profile_type = individual):** If the participant has no creator workspace yet, sync bootstraps one (same as `/tasks` eligibility) and creates tasks on their **personal board** so they appear on **/tasks**. Existing creator workspace: tasks go to their personal board.
- **Not eligible (e.g. org / company profile):** Sync does **not** create a creator workspace. The participant is added as a **member** of the org workspace and tasks are created on the **org campaign board**. They can see tasks via workspace membership (e.g. Campaigns or a “my campaign tasks” view). This fallback ensures tasks are never created in a place the intended participant cannot access.

---

## 6. Where to trigger (apps/web)

Sync is **wired** for **job application acceptance:** when an org owner/admin accepts an application via `POST /api/applications/[id]/accept`, the handler calls `triggerLinkaryCrmSync` with `org_id`, `job.id`, job title, and the applicant’s profile id. No UI change; server-side only.

- **Payload:** Use `org_id` (Linkary org id) so CRM resolves the workspace. Set `CRM_APP_URL` and `CRM_SYNC_SECRET` in apps/web env.
- **Other flows (e.g. gig acceptance):** Call `triggerLinkaryCrmSync(payload)` from the relevant server-side handler when you have org_id or workspace_id and task list.

---

## 7. Sync failure handling and recovery

- **Non-blocking:** Acceptance in apps/web succeeds even if sync fails; sync does not block or alter the 200 response.
- **Durable log:** On sync failure, the CRM API writes a row to `crm_sync_failures` (payload + `error_message`). The API response may include `sync_failure_id` for traceability; apps/web logs it when present.
- **Recovery:** Retry by sending the **same payload** again to `POST /api/sync/linkary`. Sync is idempotent, so repeated calls do not create duplicates. No separate retry endpoint; use the same sync endpoint with the same body (e.g. from `crm_sync_failures.payload`).

---

## 8. CRM env vars (for sync)

- `CRM_SYNC_SECRET` — Required for the sync API. Set the same value in apps/web when calling the sync.
- `SUPABASE_SERVICE_ROLE_KEY` — Required in apps/crm for the sync route so it can perform upserts (RLS is bypassed for this route only; the route is protected by `CRM_SYNC_SECRET`).

---

## 9. Logging

Sync failures are logged server-side with `[CRM sync]` and the error message. The API returns 4xx/5xx with a short `error` message; internal details are not exposed to the client.

---

## 10. Verification checklist (concurrent / duplicate sync)

- [ ] **Concurrent duplicate calls:** Send two identical sync requests in parallel; only one campaign, one participant, one task bundle, and the expected tasks are created; no duplicate key errors.
- [ ] **Repeated sync idempotent:** Send the same payload multiple times sequentially; no duplicate campaigns, participants, bundles, or tasks.
- [ ] **Failure then retry:** Cause a sync failure (e.g. wrong org_id), then fix and POST the same payload again; sync succeeds and records appear; no duplicates from the failed attempt.
