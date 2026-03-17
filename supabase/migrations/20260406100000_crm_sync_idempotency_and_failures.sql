-- =============================================================================
-- CRM sync: DB-level idempotency and durable failure logging.
-- - Campaign: unique (workspace_id, source_linkary_campaign_id) when source set
-- - Participant / task_bundle: already UNIQUE in schema
-- - Task: dedicated linkary_task_id column + unique (task_bundle_id, linkary_task_id)
-- - crm_sync_failures: append-only log for traceable recovery and retry
-- =============================================================================

-- Campaign: one synced campaign per workspace per Linkary campaign id (safe under concurrency)
-- Dedupe existing rows (keep one per workspace_id, source_linkary_campaign_id) before adding constraint
DELETE FROM public.crm_campaigns a
USING public.crm_campaigns b
WHERE a.source_linkary_campaign_id IS NOT NULL
  AND b.source_linkary_campaign_id IS NOT NULL
  AND a.workspace_id = b.workspace_id
  AND a.source_linkary_campaign_id = b.source_linkary_campaign_id
  AND a.id < b.id;

ALTER TABLE public.crm_campaigns
  ADD CONSTRAINT crm_campaigns_workspace_source_linkary_key
  UNIQUE (workspace_id, source_linkary_campaign_id);

-- Tasks: dedicated column for stable idempotency (instead of metadata JSON only)
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS linkary_task_id text;

COMMENT ON COLUMN public.crm_tasks.linkary_task_id IS 'Linkary task id for sync idempotency; unique per task_bundle_id when set.';

-- Backfill from metadata for existing rows
UPDATE public.crm_tasks
SET linkary_task_id = metadata->>'linkary_task_id'
WHERE task_bundle_id IS NOT NULL
  AND (metadata->>'linkary_task_id') IS NOT NULL
  AND (metadata->>'linkary_task_id') != ''
  AND linkary_task_id IS NULL;

-- Dedupe: keep one task per (task_bundle_id, linkary_task_id), remove older duplicates
DELETE FROM public.crm_tasks a
USING public.crm_tasks b
WHERE a.task_bundle_id IS NOT NULL
  AND a.linkary_task_id IS NOT NULL
  AND a.linkary_task_id = b.linkary_task_id
  AND a.task_bundle_id = b.task_bundle_id
  AND a.id < b.id;

-- Unique constraint for task idempotency under concurrency (multiple NULL linkary_task_id allowed)
ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_bundle_linkary_task_id_key
  UNIQUE (task_bundle_id, linkary_task_id);

-- Sync failures: durable log for observation and retry (retry = POST same payload again)
CREATE TABLE IF NOT EXISTS public.crm_sync_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  error_message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_sync_failures_created_at ON public.crm_sync_failures(created_at DESC);

COMMENT ON TABLE public.crm_sync_failures IS 'Append-only log of Linkary sync API failures. Retry by POSTing the same payload to /api/sync/linkary again (idempotent).';

-- RLS: no policies so only service_role (sync route) can insert/select; anon/authenticated cannot read failures.
ALTER TABLE public.crm_sync_failures ENABLE ROW LEVEL SECURITY;
