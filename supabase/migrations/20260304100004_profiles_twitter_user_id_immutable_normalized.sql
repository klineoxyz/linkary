-- Compare twitter_user_id using normalized (trim) values so whitespace-only changes are rejected.

CREATE OR REPLACE FUNCTION public.profiles_guard_twitter_user_id_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.twitter_user_id IS NOT NULL
     AND btrim(OLD.twitter_user_id) <> ''
     AND (btrim(COALESCE(NEW.twitter_user_id, '')) IS DISTINCT FROM btrim(OLD.twitter_user_id)) THEN
    RAISE EXCEPTION 'X identity cannot change for an existing profile (twitter_user_id is immutable once set)'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profiles_guard_twitter_user_id_immutable() IS
  'Ensures profiles.twitter_user_id cannot be changed to a different value once set. Comparison uses btrim so whitespace-only changes are rejected.';
