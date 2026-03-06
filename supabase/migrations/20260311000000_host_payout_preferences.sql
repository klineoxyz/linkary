-- Host payout preferences: default payout method and wallet for sponsor accept flow.
-- One row per profile; used to prefill "saved_wallet" when accepting sponsor proposals.

CREATE TABLE IF NOT EXISTS public.host_payout_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_payout_method text NOT NULL CHECK (default_payout_method IN ('saved_wallet', 'linkary_wallet')),
  wallet_address text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.host_payout_preferences IS 'Default payout method and wallet for hosts when accepting sponsor proposals; Linkary only records destination.';

CREATE INDEX IF NOT EXISTS idx_host_payout_preferences_profile ON public.host_payout_preferences (profile_id);

ALTER TABLE public.host_payout_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "host_payout_preferences_own" ON public.host_payout_preferences;
CREATE POLICY "host_payout_preferences_own" ON public.host_payout_preferences
  FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
