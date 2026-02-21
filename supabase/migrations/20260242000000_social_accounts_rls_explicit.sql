-- =============================================================================
-- RLS: Explicit policies so user can always SELECT their own social_accounts row.
-- No extra conditions. Fixes "row exists in DB but Integrations shows Connect X" when RLS was blocking.
-- =============================================================================

ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_accounts_select_own" ON public.social_accounts;
CREATE POLICY "social_accounts_select_own" ON public.social_accounts
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "social_accounts_insert_own" ON public.social_accounts;
CREATE POLICY "social_accounts_insert_own" ON public.social_accounts
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "social_accounts_update_own" ON public.social_accounts;
CREATE POLICY "social_accounts_update_own" ON public.social_accounts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON POLICY "social_accounts_select_own" ON public.social_accounts IS 'User can only SELECT their own row. No extra conditions so Integrations always sees provider=x row when it exists.';
