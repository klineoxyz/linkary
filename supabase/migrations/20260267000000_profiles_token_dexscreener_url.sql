-- Project token: Dexscreener pair URL for token price card on public profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_dexscreener_url text NULL;

COMMENT ON COLUMN public.profiles.token_dexscreener_url IS 'Dexscreener pair URL for project token (profile_type=project). Shown as token card on public page.';
