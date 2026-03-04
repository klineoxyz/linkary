-- Ensure spaces has both x_space_id and x_space_url; index x_space_id for lookups.
-- x_oauth_tokens.profile_id = auth.uid() (Supabase auth user id = profile id).

-- Both columns already exist in earlier migrations; IF NOT EXISTS is idempotent.
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS x_space_id text;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS x_space_url text;

COMMENT ON COLUMN public.spaces.x_space_id IS 'X (Twitter) Space ID when synced from X.';
COMMENT ON COLUMN public.spaces.x_space_url IS 'Optional X Space URL when host links or creates on X.';
