-- Batch 2: monthly usage counters (enforcement wiring later), external X profile cache,
-- CRM follow-rule / participant attestation storage. No behavior change until app writes these rows.

-- -----------------------------------------------------------------------------
-- 1) plan_usage_counters — monthly metered limits (profile or org scope)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plan_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  period_start date NOT NULL,
  metric_key text NOT NULL,
  count int NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, period_start, metric_key)
);

COMMENT ON TABLE public.plan_usage_counters IS
  'Monthly (UTC) usage counters for plan enforcement (e.g. API units, discovery queries). Increment via service role; RLS blocks direct client access.';

CREATE INDEX IF NOT EXISTS idx_plan_usage_counters_owner_period
  ON public.plan_usage_counters (owner_type, owner_id, period_start);

ALTER TABLE public.plan_usage_counters ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.plan_usage_counters FROM PUBLIC;
REVOKE ALL ON public.plan_usage_counters FROM anon;
REVOKE ALL ON public.plan_usage_counters FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_usage_counters TO service_role;

-- -----------------------------------------------------------------------------
-- 2) external_x_profile_cache — shared cache by normalized X handle (read-through later)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.external_x_profile_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  handle_normalized text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE (handle_normalized)
);

COMMENT ON TABLE public.external_x_profile_cache IS
  'Deduplicated cache of external X profile payloads keyed by lower handle (no @). Populated by service/worker; no public API in Phase 2.';

CREATE INDEX IF NOT EXISTS idx_external_x_profile_cache_expires
  ON public.external_x_profile_cache (expires_at);

ALTER TABLE public.external_x_profile_cache ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.external_x_profile_cache FROM PUBLIC;
REVOKE ALL ON public.external_x_profile_cache FROM anon;
REVOKE ALL ON public.external_x_profile_cache FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_x_profile_cache TO service_role;

-- -----------------------------------------------------------------------------
-- 3) CRM: campaign-level follow rule storage (enforcement deferred)
-- -----------------------------------------------------------------------------
ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS follow_rules jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.crm_campaigns.follow_rules IS
  'Campaign-level follow expectations (e.g. must_follow_handles, notes). UI/enforcement in later phases; storage only.';

-- -----------------------------------------------------------------------------
-- 4) CRM: participant follow attestation / verification (enforcement deferred)
-- -----------------------------------------------------------------------------
ALTER TABLE public.crm_campaign_participants
  ADD COLUMN IF NOT EXISTS x_follow_attestation jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS x_follow_verification jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.crm_campaign_participants.x_follow_attestation IS
  'Creator-submitted follow attestation payload; verification workflow later.';

COMMENT ON COLUMN public.crm_campaign_participants.x_follow_verification IS
  'Operator/system verification result for X follow; blocking rules later.';

-- -----------------------------------------------------------------------------
-- 5) Audit log note: target_id is uuid-only
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public.platform_audit_log.target_id IS
  'Optional uuid target (profile/org/job/etc.). Non-uuid external ids (e.g. Stripe) must live in payload_json until a text target column exists.';
