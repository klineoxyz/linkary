-- Grandfather existing users: set inviter_id to Linkary admin so they show as "Invited by Linkary"
-- and retain access when invite-only is on. Only updates profiles that have no inviter_id yet.

DO $$
DECLARE
  v_admin_id uuid;
  v_updated int;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE LOWER(TRIM(BOTH '@' FROM COALESCE(twitter_username, ''))) = 'muazxinthi'
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'linkary_legacy_invite: no admin profile (twitter_username = muazxinthi) found; skipping.';
    RETURN;
  END IF;

  UPDATE public.profiles
  SET inviter_id = v_admin_id
  WHERE inviter_id IS NULL
    AND id != v_admin_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE 'linkary_legacy_invite: set inviter_id to Linkary admin for % profile(s).', v_updated;
END $$;
