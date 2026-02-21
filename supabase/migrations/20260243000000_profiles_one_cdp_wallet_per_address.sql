-- =============================================================================
-- One CDP wallet address per profile (prevent same wallet on two users).
-- Run after resolving existing duplicates (e.g. clear cdp_wallet_address on the
-- profile you want to detach, or delete the duplicate profile).
-- If this migration fails with "duplicate key", fix duplicates first then re-run.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_cdp_wallet_address_unique
  ON public.profiles (lower(trim(cdp_wallet_address)))
  WHERE cdp_wallet_address IS NOT NULL AND trim(cdp_wallet_address) <> '';

COMMENT ON INDEX public.idx_profiles_cdp_wallet_address_unique IS 'One Linkary profile per CDP wallet address; prevents same wallet linked to two accounts.';
