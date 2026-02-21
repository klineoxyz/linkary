-- Canonical DB truth for "X is connected" so UI never depends on flaky identities.
-- x_connected = true when twitter_username or twitter_user_id is set; maintained by trigger.

-- 1) Add x_connected if missing (twitter_username, twitter_user_id, twitter_connected_at already exist from prior migrations)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS x_connected boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.x_connected IS 'Canonical DB truth: true when profile has twitter_username or twitter_user_id. Do not use identities for UI.';

-- 2) Trigger: keep x_connected in sync with twitter_username / twitter_user_id
CREATE OR REPLACE FUNCTION public.profiles_set_x_connected()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.twitter_username IS NOT NULL AND TRIM(NEW.twitter_username) <> '')
     OR (NEW.twitter_user_id IS NOT NULL AND TRIM(NEW.twitter_user_id) <> '') THEN
    NEW.x_connected := true;
  ELSE
    NEW.x_connected := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_x_connected_trigger ON public.profiles;
CREATE TRIGGER profiles_x_connected_trigger
  BEFORE INSERT OR UPDATE OF twitter_username, twitter_user_id
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_set_x_connected();

-- 3) Backfill: set x_connected = true where we already have handle or user id
UPDATE public.profiles
SET x_connected = true
WHERE x_connected = false
  AND (
    (twitter_username IS NOT NULL AND TRIM(twitter_username) <> '')
    OR (twitter_user_id IS NOT NULL AND TRIM(twitter_user_id) <> '')
  );

-- 4) Index for filtering by connection state
CREATE INDEX IF NOT EXISTS idx_profiles_x_connected ON public.profiles (x_connected) WHERE x_connected = true;

-- Index on lower(trim(twitter_username)) already exists as unique_twitter_username in 20260231000001_twitter_username_unique.sql
