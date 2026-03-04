-- X OAuth tokens for API access (e.g. Spaces by creator, future X API calls).
-- Separate from Supabase Auth; used by backend to call X API on behalf of the user.

CREATE TABLE IF NOT EXISTS public.x_oauth_tokens (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'x' CHECK (provider = 'x'),
  access_token text NOT NULL,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  x_user_id text,
  x_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_x_oauth_tokens_provider ON public.x_oauth_tokens (provider);
CREATE INDEX IF NOT EXISTS idx_x_oauth_tokens_x_user_id ON public.x_oauth_tokens (x_user_id) WHERE x_user_id IS NOT NULL;

ALTER TABLE public.x_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_oauth_tokens_select_own" ON public.x_oauth_tokens;
CREATE POLICY "x_oauth_tokens_select_own" ON public.x_oauth_tokens
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "x_oauth_tokens_insert_own" ON public.x_oauth_tokens;
CREATE POLICY "x_oauth_tokens_insert_own" ON public.x_oauth_tokens
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "x_oauth_tokens_update_own" ON public.x_oauth_tokens;
CREATE POLICY "x_oauth_tokens_update_own" ON public.x_oauth_tokens
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "x_oauth_tokens_delete_own" ON public.x_oauth_tokens;
CREATE POLICY "x_oauth_tokens_delete_own" ON public.x_oauth_tokens
  FOR DELETE USING (profile_id = auth.uid());

COMMENT ON TABLE public.x_oauth_tokens IS 'X (Twitter) OAuth tokens for backend X API calls (Spaces, etc.). Owner-only access via RLS.';
