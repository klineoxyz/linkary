# Linkary → CRM sync contract

Idempotent sync from Linkary (sprint/gig acceptance) into CRM: campaign, participant, task bundle, and tasks. Duplicate triggers do not duplicate records.

---

## 1. Endpoint

- **URL:** `POST {CRM_APP_URL}/api/sync/linkary` (e.g. `https://crm.linkary.xyz/api/sync/linkary`)
- **Auth:** Header `Authorization: Bearer <CRM_SYNC_SECRET>` or `X-CRM-Sync-Secret: <CRM_SYNC_SECRET>`
- **Body:** JSON payload (see below).

---

## 2. Payload

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `workspace_id` | string (UUID) | Yes | CRM workspace id (org/project/brand/agency). Caller must resolve Linkary org → CRM workspace. |
| `source_linkary_campaign_id` | string | Yes | Linkary campaign/sprint/gig identifier. Used for idempotent campaign upsert. |
| `campaign_title` | string | No | Campaign title; applied on create and on subsequent sync (upsert). |
| `participant_profile_id` | string (UUID) | Yes | `profiles.id` of the creator who accepted. |
| `tasks` | array | Yes | At least one task. Each item: see below. |

**Task item:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `linkary_task_id` | string | Yes | Unique id for this task in Linkary. Used to avoid duplicate tasks on re-sync. |
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

## 3. Source identifiers and idempotency

- **Campaign:** `(workspace_id, source_linkary_campaign_id)`. If a campaign exists with this `source_linkary_campaign_id` in the workspace, it is updated (e.g. title); otherwise created.
- **Participant:** `(campaign_id, participant_profile_id)`. Insert only if not present.
- **Task bundle:** `(campaign_id, participant_profile_id)`. One bundle per participant per campaign; create only if not present.
- **Tasks:** `(task_bundle_id, metadata->>'linkary_task_id')`. Each task’s `linkary_task_id` is stored in `metadata.linkary_task_id`. If a task with the same bundle and `linkary_task_id` exists, it is skipped.

Repeated POSTs with the same payload do not create duplicate campaigns, participants, bundles, or tasks.

---

## 4. Where to trigger (apps/web)

Call the sync **once** after a sprint/gig is accepted (creator has accepted participation). Prefer a single server-side call from the handler that performs the acceptance (e.g. after updating collab_request status to accepted or after creating a gig_deal).

- **Minimal integration:** In apps/web, call `triggerLinkaryCrmSync(payload)` from server-side only (see `apps/web/src/lib/crm-sync.ts`). Set `CRM_APP_URL` (e.g. `https://crm.linkary.xyz`) and `CRM_SYNC_SECRET` (same as in CRM) in apps/web env.
- **Resolving `workspace_id`:** You need the CRM workspace id for the org that owns the sprint/gig. Options: store `crm_workspace_id` on the Linkary org, or have a small mapping table/API that returns CRM workspace id by Linkary org id.

---

## 5. CRM env vars (for sync)

- `CRM_SYNC_SECRET` — Required for the sync API. Set the same value in apps/web when calling the sync.
- `SUPABASE_SERVICE_ROLE_KEY` — Required in apps/crm for the sync route so it can perform upserts (RLS is bypassed for this route only; the route is protected by `CRM_SYNC_SECRET`).

---

## 6. Logging

Sync failures are logged server-side with `[CRM sync]` and the error message. The API returns 4xx/5xx with a short `error` message; do not expose internal details to the client.
