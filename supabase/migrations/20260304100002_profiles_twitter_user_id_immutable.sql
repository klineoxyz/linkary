-- Enforce X user ID as canonical identity: once set, it must never change.
-- Prevents account takeover and cross-account merging.

CREATE OR REPLACE FUNCTION public.profiles_guard_twitter_user_id_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.twitter_user_id IS NOT NULL
     AND btrim(OLD.twitter_user_id) <> ''
     AND (NEW.twitter_user_id IS DISTINCT FROM OLD.twitter_user_id) THEN
    RAISE EXCEPTION 'X identity cannot change for an existing profile (twitter_user_id is immutable once set)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_twitter_user_id_immutable ON public.profiles;
CREATE TRIGGER trg_profiles_twitter_user_id_immutable
  BEFORE UPDATE OF twitter_user_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_twitter_user_id_immutable();

COMMENT ON FUNCTION public.profiles_guard_twitter_user_id_immutable() IS
  'Ensures profiles.twitter_user_id cannot be changed to a different value once set. X user ID is the single source of truth for identity.';
