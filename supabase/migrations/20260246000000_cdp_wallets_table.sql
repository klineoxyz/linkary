-- =============================================================================
-- CDP wallets table: canonical wallet + X recovery binding (keeps profiles.cdp_wallet_* for backward compat)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.cdp_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_address text,
  wallet_chain text,
  cdp_wallet_id text,
  recovery_provider text,
  recovery_provider_user_id text,
  recovery_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cdp_wallets_recovery_idx ON public.cdp_wallets (recovery_verified_at);

COMMENT ON TABLE public.cdp_wallets IS 'CDP embedded wallet per user; X recovery binding with strict cross-check vs social_accounts.';

ALTER TABLE public.cdp_wallets ENABLE ROW LEVEL SECURITY;

-- Only own row
DROP POLICY IF EXISTS "cdp_wallets_select_own" ON public.cdp_wallets;
CREATE POLICY "cdp_wallets_select_own" ON public.cdp_wallets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cdp_wallets_insert_own" ON public.cdp_wallets;
CREATE POLICY "cdp_wallets_insert_own" ON public.cdp_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cdp_wallets_update_own" ON public.cdp_wallets;
CREATE POLICY "cdp_wallets_update_own" ON public.cdp_wallets
  FOR UPDATE USING (auth.uid() = user_id);

-- Enrollment state for X recovery flow (state_token -> user_id); short-lived, server-only
CREATE TABLE IF NOT EXISTS public.cdp_recovery_enrollment_state (
  state_token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cdp_recovery_enrollment_state_created_at ON public.cdp_recovery_enrollment_state (created_at);

COMMENT ON TABLE public.cdp_recovery_enrollment_state IS 'Short-lived state for CDP X recovery enrollment; used by callback to resolve state -> user_id.';

ALTER TABLE public.cdp_recovery_enrollment_state ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own state only; callback reads with service_role
DROP POLICY IF EXISTS "cdp_recovery_enrollment_state_insert_own" ON public.cdp_recovery_enrollment_state;
CREATE POLICY "cdp_recovery_enrollment_state_insert_own" ON public.cdp_recovery_enrollment_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
