-- =============================================================================
-- Linkary: RLS and indexes (run in Supabase SQL Editor or via supabase db push)
-- =============================================================================

-- =============================================================================
-- RLS for public.profiles
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- RLS for public.wallets
-- =============================================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_public" ON public.wallets;
CREATE POLICY "wallets_select_public" ON public.wallets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "wallets_insert_own" ON public.wallets;
CREATE POLICY "wallets_insert_own" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_update_own" ON public.wallets;
CREATE POLICY "wallets_update_own" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_delete_own" ON public.wallets;
CREATE POLICY "wallets_delete_own" ON public.wallets
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- RLS for public.wallet_link_nonces (if table exists)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallet_link_nonces') THEN
    EXECUTE 'ALTER TABLE public.wallet_link_nonces ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_link_nonces_select_own" ON public.wallet_link_nonces';
    EXECUTE 'CREATE POLICY "wallet_link_nonces_select_own" ON public.wallet_link_nonces FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_link_nonces_insert_own" ON public.wallet_link_nonces';
    EXECUTE 'CREATE POLICY "wallet_link_nonces_insert_own" ON public.wallet_link_nonces FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_link_nonces_update_own" ON public.wallet_link_nonces';
    EXECUTE 'CREATE POLICY "wallet_link_nonces_update_own" ON public.wallet_link_nonces FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- =============================================================================
-- Indexes for high-read paths
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets (user_id);
