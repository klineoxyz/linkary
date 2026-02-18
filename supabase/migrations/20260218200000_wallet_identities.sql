-- =============================================================================
-- Linkary: wallet_identities for CDP wallet -> Supabase auth user mapping
-- Used by auth-cdp-login Edge Function to find/create user by verified address.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.wallet_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(address)
);

CREATE INDEX IF NOT EXISTS idx_wallet_identities_address ON public.wallet_identities (address);
CREATE INDEX IF NOT EXISTS idx_wallet_identities_user_id ON public.wallet_identities (user_id);

-- RLS: no direct client access; Edge Function uses service role
ALTER TABLE public.wallet_identities ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (no policies = deny all for anon/authenticated)
-- Edge function runs with service role and can manage wallet_identities.

COMMENT ON TABLE public.wallet_identities IS 'Maps wallet address to auth.users.id for CDP login bridge';
