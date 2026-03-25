-- Normalized X handle for matching CRM promoted_social_handles to profiles (ingestion + reporting).
-- Keeps logic aligned with normalizeTrackedXHandle: lowercase, strip @, remove spaces.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitter_username_norm text
  GENERATED ALWAYS AS (
    nullif(
      lower(
        regexp_replace(
          replace(trim(both '@' from trim(coalesce(twitter_username, ''))), ' ', ''),
          '^@+',
          '',
          'g'
        )
      ),
      ''
    )
  ) STORED;

COMMENT ON COLUMN public.profiles.twitter_username_norm IS
  'Lowercase normalized X handle for joins (no @, no spaces). Maintained by Postgres; use for CRM campaign metrics linkage.';

CREATE INDEX IF NOT EXISTS idx_profiles_twitter_username_norm
  ON public.profiles (twitter_username_norm)
  WHERE twitter_username_norm IS NOT NULL;
