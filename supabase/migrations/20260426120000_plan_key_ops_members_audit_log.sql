-- Batch 1: plan_key on subscriptions, internal ops membership, platform audit log.
-- RLS: ops + audit are service-role only (same pattern as superadmin_emails / discovery_access_log).

-- -----------------------------------------------------------------------------
-- 1) subscriptions.plan_key
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS plan_key text;

COMMENT ON COLUMN public.subscriptions.plan_key IS
  'Commercial package key: free|nano|kol|startup|unicorn|custom. Nullable only before backfill; app uses effectivePlanKey() with tier fallback.';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_key_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_key_check
  CHECK (
    plan_key IS NULL
    OR plan_key IN ('free', 'nano', 'kol', 'startup', 'unicorn', 'custom')
  );

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_key ON public.subscriptions (plan_key)
  WHERE plan_key IS NOT NULL;

-- Safe backfill from legacy tier (idempotent for NULL plan_key only).
UPDATE public.subscriptions
SET plan_key = CASE lower(trim(tier))
  WHEN 'free' THEN 'free'
  WHEN 'pro' THEN 'kol'
  WHEN 'host' THEN 'kol'
  WHEN 'brand' THEN 'startup'
  WHEN 'venture' THEN 'unicorn'
  ELSE 'free'
END
WHERE plan_key IS NULL;

-- -----------------------------------------------------------------------------
-- 2) internal_ops_members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.internal_ops_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('ops_super', 'ops_finance', 'ops_support', 'ops_readonly')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  note text
);

COMMENT ON TABLE public.internal_ops_members IS
  'Platform internal ops users for crm.linkary.xyz/ops. At most one active (revoked_at IS NULL) row per user_id.';

CREATE INDEX IF NOT EXISTS idx_internal_ops_members_user_id ON public.internal_ops_members (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS internal_ops_members_one_active_per_user
  ON public.internal_ops_members (user_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.internal_ops_members ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated: only service_role (backend) reads/writes for now.
REVOKE ALL ON public.internal_ops_members FROM PUBLIC;
REVOKE ALL ON public.internal_ops_members FROM anon;
REVOKE ALL ON public.internal_ops_members FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_ops_members TO service_role;

-- -----------------------------------------------------------------------------
-- 3) platform_audit_log
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_audit_log IS
  'Append-only platform audit trail for internal ops actions. Separate from crm_activity_log. Inserts via service role only.';

CREATE INDEX IF NOT EXISTS idx_platform_audit_log_created_at ON public.platform_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_actor ON public.platform_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_audit_log_target ON public.platform_audit_log (target_type, target_id);

ALTER TABLE public.platform_audit_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_audit_log FROM PUBLIC;
REVOKE ALL ON public.platform_audit_log FROM anon;
REVOKE ALL ON public.platform_audit_log FROM authenticated;
GRANT SELECT, INSERT ON public.platform_audit_log TO service_role;
