-- =============================================================================
-- Superadmin emails (SQL-backed so admins can be added without redeploy)
-- and profiles.email so users can store/update their email in app data.
-- =============================================================================

-- 1) superadmin_emails: list of emails that can trigger backfill for any profile (e.g. superadmin)
CREATE TABLE IF NOT EXISTS public.superadmin_emails (
  email text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  note text
);

COMMENT ON TABLE public.superadmin_emails IS 'Emails that have superadmin rights (e.g. trigger analytics backfill for any profile). Manage via SQL or admin UI.';

ALTER TABLE public.superadmin_emails ENABLE ROW LEVEL SECURITY;

-- Only service role can read/write (no anon/authenticated policy = only backend with service key)
-- So app uses service client to check this table in ensure-backfill.

-- Seed: mmxinthi@gmail.com (connected to X user @muazxinthix)
INSERT INTO public.superadmin_emails (email, note)
VALUES ('mmxinthi@gmail.com', 'Super admin; X: @muazxinthix')
ON CONFLICT (email) DO UPDATE SET note = EXCLUDED.note;

-- 2) profiles.email: user's email (synced from auth or set by user; source of truth for "user's email" in app)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

COMMENT ON COLUMN public.profiles.email IS 'User email; can be synced from auth.users and updated by user in settings.';

-- Optional: index for lookups by email (e.g. "find profile by email")
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles (LOWER(email)) WHERE email IS NOT NULL;
