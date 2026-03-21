-- Phase 4: reversible ops-driven entitlements (comp, discount metadata, plan override).
-- Enforcement reads merge active rows (non-revoked, expires_at > now) in app; Stripe remains source of truth for billing long-term.

CREATE TABLE IF NOT EXISTS public.platform_ops_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('profile', 'org')),
  subject_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('comp_grant', 'discount_metadata', 'plan_override')),
  expires_at timestamptz NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT
);

COMMENT ON TABLE public.platform_ops_entitlements IS
  'Ops-managed entitlements: comp scopes, discount metadata, temporary plan_key override. Revoke via revoked_at; no hard delete required.';

CREATE INDEX IF NOT EXISTS idx_platform_ops_entitlements_subject_active
  ON public.platform_ops_entitlements (subject_type, subject_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_ops_entitlements_expires
  ON public.platform_ops_entitlements (expires_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_platform_ops_entitlements_kind
  ON public.platform_ops_entitlements (kind)
  WHERE revoked_at IS NULL;

ALTER TABLE public.platform_ops_entitlements ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.platform_ops_entitlements FROM PUBLIC;
REVOKE ALL ON public.platform_ops_entitlements FROM anon;
REVOKE ALL ON public.platform_ops_entitlements FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.platform_ops_entitlements TO service_role;
