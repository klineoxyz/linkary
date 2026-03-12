-- Invite wallet + attribution schema (additive; does not break existing invite flows).
-- Adds: owner_user_id, redeemed_by_user_id, redeemed_at, source_reason to invite_codes.
-- Creates: invite_credit_ledger, invite_attributions, invite_policy_state.

-- 1) Extend invite_codes for wallet ownership and redemption tracking
ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS redeemed_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_reason text;

COMMENT ON COLUMN public.invite_codes.owner_user_id IS 'User who owns this code slot (wallet). For batch-issued codes may equal issued_by_id when profile.';
COMMENT ON COLUMN public.invite_codes.redeemed_by_user_id IS 'Set when code is redeemed; redeemer user id.';
COMMENT ON COLUMN public.invite_codes.redeemed_at IS 'When the code was redeemed.';
COMMENT ON COLUMN public.invite_codes.source_reason IS 'base | activity_reward | manual | conversion_reward | legacy (null for pre-wallet codes).';

-- Backfill owner_user_id for existing profile-issued codes (profile id = user id in Linkary)
UPDATE public.invite_codes
SET owner_user_id = issued_by_id
WHERE issued_by_type = 'profile' AND issued_by_id IS NOT NULL AND owner_user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_invite_codes_owner_user_id
  ON public.invite_codes (owner_user_id) WHERE owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invite_codes_source_reason
  ON public.invite_codes (source_reason) WHERE source_reason IS NOT NULL;

-- 2) Invite credit ledger (reserve credits: +1 for rewards, -1 when used to create a code)
CREATE TABLE IF NOT EXISTS public.invite_credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta int NOT NULL CHECK (delta != 0),
  reason text NOT NULL,
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_credit_ledger_user ON public.invite_credit_ledger (user_id);
CREATE INDEX IF NOT EXISTS idx_invite_credit_ledger_created ON public.invite_credit_ledger (created_at DESC);

COMMENT ON TABLE public.invite_credit_ledger IS 'Reserve invite credits: + for rewards (profile_complete, verified_social, first_activity, invitee_active, org_active, package_purchase), - when used to issue a wallet code.';

-- 3) Invite attributions (inviter -> invitee -> org -> package purchase)
CREATE TABLE IF NOT EXISTS public.invite_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code_id uuid REFERENCES public.invite_codes(id) ON DELETE SET NULL,
  invitee_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  became_active_at timestamptz,
  package_purchase_id uuid,
  package_type text,
  package_amount_cents int,
  package_purchased_at timestamptz,
  attribution_status text NOT NULL DEFAULT 'redeemed' CHECK (attribution_status IN ('redeemed', 'invitee_active', 'org_created', 'package_purchased')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_attributions_invitee
  ON public.invite_attributions (invitee_user_id);
CREATE INDEX IF NOT EXISTS idx_invite_attributions_inviter ON public.invite_attributions (inviter_user_id);
CREATE INDEX IF NOT EXISTS idx_invite_attributions_code ON public.invite_attributions (invite_code_id) WHERE invite_code_id IS NOT NULL;

COMMENT ON TABLE public.invite_attributions IS 'One row per invited user. Tracks inviter, invitee, org, and optional package purchase for 90-day attribution.';

-- 4) Invite policy state (cache for healthy-account and replenishment)
CREATE TABLE IF NOT EXISTS public.invite_policy_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_codes_count int NOT NULL DEFAULT 0 CHECK (active_codes_count >= 0 AND active_codes_count <= 5),
  reserve_credits int NOT NULL DEFAULT 0 CHECK (reserve_credits >= 0 AND reserve_credits <= 10),
  lifetime_invites_sent int NOT NULL DEFAULT 0,
  successful_invites int NOT NULL DEFAULT 0,
  suspicious_invite_score int NOT NULL DEFAULT 0,
  monthly_issued_count int NOT NULL DEFAULT 0,
  last_replenished_at timestamptz,
  frozen_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.invite_policy_state IS 'Per-user invite wallet state. active_codes_count = count of available/unexpired wallet codes; reserve_credits capped at 10. frozen_until = admin freeze.';

-- RLS for new tables
ALTER TABLE public.invite_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_policy_state ENABLE ROW LEVEL SECURITY;

-- Ledger: user sees own rows only; insert/update only via RPC or service
CREATE POLICY invite_credit_ledger_select_own ON public.invite_credit_ledger FOR SELECT
  USING (user_id = auth.uid());

-- Attributions: inviter sees rows where they are inviter; invitee sees own row
CREATE POLICY invite_attributions_select_inviter ON public.invite_attributions FOR SELECT
  USING (inviter_user_id = auth.uid());
CREATE POLICY invite_attributions_select_invitee ON public.invite_attributions FOR SELECT
  USING (invitee_user_id = auth.uid());

-- Policy state: user sees own row only; updates only via RPC
CREATE POLICY invite_policy_state_select_own ON public.invite_policy_state FOR SELECT
  USING (user_id = auth.uid());

GRANT SELECT ON public.invite_credit_ledger TO authenticated;
GRANT SELECT ON public.invite_attributions TO authenticated;
GRANT SELECT ON public.invite_policy_state TO authenticated;
