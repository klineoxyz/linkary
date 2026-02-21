-- =============================================================================
-- X connect once, stay connected forever: constraints + indexes + RLS verification
-- =============================================================================

-- 1) Only one active X per user (partial unique: one connected row per user_id + provider)
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_one_active_x_per_user
  ON public.social_accounts (user_id, provider)
  WHERE revoked_at IS NULL AND status = 'connected';

-- 2) One X account cannot be connected to multiple Linkary users
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_one_x_per_provider_user
  ON public.social_accounts (provider, provider_user_id)
  WHERE revoked_at IS NULL AND status = 'connected' AND provider_user_id IS NOT NULL AND trim(provider_user_id) <> '';

-- 3) Indexes for cron and lookups
CREATE INDEX IF NOT EXISTS idx_social_accounts_provider_revoked
  ON public.social_accounts (provider, revoked_at)
  WHERE revoked_at IS NULL;

-- 4) RLS: ensure SELECT/INSERT/UPDATE only where user_id = auth.uid(); no public access
DROP POLICY IF EXISTS "social_accounts_select_own" ON public.social_accounts;
CREATE POLICY "social_accounts_select_own" ON public.social_accounts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_accounts_insert_own" ON public.social_accounts;
CREATE POLICY "social_accounts_insert_own" ON public.social_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "social_accounts_update_own" ON public.social_accounts;
CREATE POLICY "social_accounts_update_own" ON public.social_accounts
  FOR UPDATE USING (auth.uid() = user_id);

-- No DELETE policy: revoke via UPDATE (revoked_at, status) only.

COMMENT ON INDEX public.idx_social_accounts_one_active_x_per_user IS 'One active X connection per user.';
COMMENT ON INDEX public.idx_social_accounts_one_x_per_provider_user IS 'One Linkary user per X account (prevents same X connected to multiple accounts).';
