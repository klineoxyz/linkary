# CRM pre-launch verification (operational safety)

Minimal checks and backfill guidance before launch. Run SQL in Supabase SQL Editor (or via script) with appropriate role.

---

## 1. linked_org_id backfill plan

**Requirement:** For Linkary → CRM sync to resolve workspace by `org_id`, every org/project/brand/agency CRM workspace that corresponds to a Linkary org must have `linked_org_id` set to that org’s `orgs.id`.

**Audit (list org-style workspaces missing linked_org_id):**

```sql
SELECT id, type, slug, name, owner_profile_id, linked_org_id
FROM public.crm_workspaces
WHERE type IN ('org', 'project', 'brand', 'agency')
  AND linked_org_id IS NULL
ORDER BY created_at DESC;
```

**Backfill (safe, manual):** For each workspace that should map to a Linkary org, set `linked_org_id` to the Linkary `orgs.id`. Get the org id from Linkary (e.g. org profile URL or `orgs` table).

```sql
-- Example: set one workspace’s linked_org_id (replace UUIDs).
UPDATE public.crm_workspaces
SET linked_org_id = '<linkary_orgs.id>', updated_at = now()
WHERE id = '<crm_workspace_id>';
```

**Uniqueness:** After migration `20260406100001_crm_linked_org_id_index_and_unique.sql`, at most one org-style workspace can have a given `linked_org_id`. If you need to link a different workspace to the same org, clear `linked_org_id` on the old one first.

---

## 2. Internal verification SQL checklist

Run these in order. Expect zero rows for the duplicate checks and (optionally) review any rows for missing linked_org_id and recent failures.

### 2.1 Duplicate campaigns (workspace_id + source_linkary_campaign_id)

Should return **0 rows** (constraint enforces this; use to verify before/after migrations).

```sql
SELECT workspace_id, source_linkary_campaign_id, count(*)
FROM public.crm_campaigns
WHERE source_linkary_campaign_id IS NOT NULL
GROUP BY workspace_id, source_linkary_campaign_id
HAVING count(*) > 1;
```

### 2.2 Duplicate tasks (task_bundle_id + linkary_task_id)

Should return **0 rows** (constraint enforces this).

```sql
SELECT task_bundle_id, linkary_task_id, count(*)
FROM public.crm_tasks
WHERE task_bundle_id IS NOT NULL AND linkary_task_id IS NOT NULL AND linkary_task_id != ''
GROUP BY task_bundle_id, linkary_task_id
HAVING count(*) > 1;
```

### 2.3 Missing linked_org_id on org-style workspaces

Lists org/project/brand/agency workspaces that have no Linkary org link. These will not resolve when sync sends `org_id`; either backfill or create the link when the org is used for jobs.

```sql
SELECT id, type, slug, name, created_at
FROM public.crm_workspaces
WHERE type IN ('org', 'project', 'brand', 'agency')
  AND linked_org_id IS NULL
ORDER BY created_at DESC;
```

### 2.4 Recent sync failures

Inspect recent sync failures for retry or debugging. Use `payload` to retry via `POST /api/sync/linkary` with the same body.

```sql
SELECT id, error_message, created_at,
       (payload->>'source_linkary_campaign_id') AS source_campaign,
       (payload->>'participant_profile_id') AS participant
FROM public.crm_sync_failures
ORDER BY created_at DESC
LIMIT 50;
```

---

## 3. Quick pre-launch run

1. Run **2.1** and **2.2** — expect 0 rows.
2. Run **2.3** — backfill any org-style workspaces that need to receive sync (job-accepting orgs).
3. Run **2.4** — triage any recent failures; retry if needed.
