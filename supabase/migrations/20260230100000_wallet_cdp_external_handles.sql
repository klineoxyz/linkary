-- =============================================================================
-- Linkary: CDP embedded wallet metadata on profiles + external_wallets + wallet_handles
-- For wallet tab: get-or-create CDP wallet, external wallets, send-by-handle.
-- =============================================================================

-- 1) profiles: CDP wallet columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cdp_wallet_address text,
  ADD COLUMN IF NOT EXISTS cdp_wallet_chain text NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS cdp_wallet_type text DEFAULT 'smart_account',
  ADD COLUMN IF NOT EXISTS cdp_wallet_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS cdp_mfa_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.cdp_wallet_address IS 'CDP embedded wallet address; stable per auth.users.id';
COMMENT ON COLUMN public.profiles.cdp_wallet_chain IS 'Chain for CDP wallet; default base';
COMMENT ON COLUMN public.profiles.cdp_wallet_type IS 'CDP wallet type; e.g. smart_account';
COMMENT ON COLUMN public.profiles.cdp_wallet_created_at IS 'When CDP wallet was created';
COMMENT ON COLUMN public.profiles.cdp_mfa_enabled IS 'MFA enabled for this profile (required for key export)';

-- 2) external_wallets: user-linked external addresses
CREATE TABLE IF NOT EXISTS public.external_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chain text NOT NULL,
  address text NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, chain, address)
);

CREATE INDEX IF NOT EXISTS idx_external_wallets_profile_id ON public.external_wallets (profile_id);

-- Only one primary per profile
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_wallets_one_primary_per_profile
  ON public.external_wallets (profile_id) WHERE is_primary = true;

ALTER TABLE public.external_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "external_wallets_select_own" ON public.external_wallets
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "external_wallets_insert_own" ON public.external_wallets
  FOR INSERT WITH CHECK (profile_id = auth.uid());

CREATE POLICY "external_wallets_update_own" ON public.external_wallets
  FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "external_wallets_delete_own" ON public.external_wallets
  FOR DELETE USING (profile_id = auth.uid());

COMMENT ON TABLE public.external_wallets IS 'External wallet addresses linked to a profile; one can be primary for receive/send-by-handle';

-- 3) wallet_handles: username -> preferred address (server-only updates; public resolve via API)
CREATE TABLE IF NOT EXISTS public.wallet_handles (
  username text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_chain text NOT NULL DEFAULT 'base',
  preferred_address text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_handles_profile_id ON public.wallet_handles (profile_id);

ALTER TABLE public.wallet_handles ENABLE ROW LEVEL SECURITY;

-- No policies: only service role / server can read/write. Public resolve via /api/wallet/resolve only.
COMMENT ON TABLE public.wallet_handles IS 'Linkary username to preferred wallet address; updated server-side when primary changes';
