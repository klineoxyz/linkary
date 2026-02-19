-- =============================================================================
-- Fix: claim_username_for_profile must handle profiles.username unique constraint.
-- When username is not in usernames table, another profile/org may still have
-- that value in profiles.username / orgs.slug (legacy or race). Check and
-- run takeover before assigning to avoid duplicate key on profiles_username_key.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.claim_username_for_profile(desired_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id uuid;
  normalized text;
  existing record;
  shortid text;
  new_test_username text;
  other_profile_id uuid;
  other_org_id uuid;
BEGIN
  profile_id := auth.uid();
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  normalized := public.normalize_username(desired_username);
  IF normalized = '' OR length(normalized) < 2 THEN
    RAISE EXCEPTION 'Invalid username';
  END IF;

  -- 1) Check usernames table first
  SELECT u.username, u.owner_type, u.owner_id, u.verified_at
    INTO existing
    FROM public.usernames u
    WHERE u.username = normalized
    LIMIT 1;

  IF FOUND THEN
    -- Already in usernames: same-owner or takeover
    IF existing.owner_type = 'profile' AND existing.owner_id = profile_id THEN
      UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
      RETURN;
    END IF;
    shortid := left(replace(gen_random_uuid()::text, '-', ''), 8);
    IF existing.owner_type = 'profile' THEN
      IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = existing.owner_id AND p.twitter_connected_at IS NULL) THEN
        new_test_username := 'test-' || shortid;
        UPDATE public.usernames SET username = new_test_username, verified_at = NULL WHERE username = normalized;
        UPDATE public.profiles SET username = new_test_username, updated_at = now() WHERE id = existing.owner_id;
        INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
        VALUES (normalized, 'profile', profile_id, 'x', now());
        UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
        RETURN;
      END IF;
      RAISE EXCEPTION 'USERNAME_TAKEN_VERIFIED';
    END IF;
    IF existing.owner_type = 'org' THEN
      IF existing.verified_at IS NULL THEN
        new_test_username := 'test-org-' || shortid;
        UPDATE public.usernames SET username = new_test_username, verified_at = NULL WHERE username = normalized;
        UPDATE public.orgs SET slug = new_test_username, updated_at = now() WHERE id = existing.owner_id;
        INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
        VALUES (normalized, 'profile', profile_id, 'x', now());
        UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
        RETURN;
      END IF;
      RAISE EXCEPTION 'USERNAME_TAKEN_VERIFIED';
    END IF;
    RAISE EXCEPTION 'USERNAME_TAKEN_VERIFIED';
  END IF;

  -- 2) Not in usernames: check denormalized profiles.username / orgs.slug (avoids profiles_username_key violation)
  SELECT p.id INTO other_profile_id
  FROM public.profiles p
  WHERE public.normalize_username(p.username) = normalized AND p.id <> profile_id
  LIMIT 1;

  IF FOUND THEN
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = other_profile_id AND p.twitter_connected_at IS NULL) THEN
      shortid := left(replace(gen_random_uuid()::text, '-', ''), 8);
      new_test_username := 'test-' || shortid;
      UPDATE public.profiles SET username = new_test_username, updated_at = now() WHERE id = other_profile_id;
      INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
      VALUES (new_test_username, 'profile', other_profile_id, NULL, NULL)
      ON CONFLICT (username) DO NOTHING;
      INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
      VALUES (normalized, 'profile', profile_id, 'x', now());
      UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
      RETURN;
    END IF;
    RAISE EXCEPTION 'USERNAME_TAKEN_VERIFIED';
  END IF;

  SELECT o.id INTO other_org_id
  FROM public.orgs o
  WHERE public.normalize_username(o.slug) = normalized
  LIMIT 1;

  IF FOUND THEN
    shortid := left(replace(gen_random_uuid()::text, '-', ''), 8);
    new_test_username := 'test-org-' || shortid;
    UPDATE public.orgs SET slug = new_test_username, updated_at = now() WHERE id = other_org_id;
    INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
    VALUES (new_test_username, 'org', other_org_id, NULL, NULL)
    ON CONFLICT (username) DO NOTHING;
    INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
    VALUES (normalized, 'profile', profile_id, 'x', now());
    UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
    RETURN;
  END IF;

  -- 3) Free: insert and update profile
  INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
  VALUES (normalized, 'profile', profile_id, 'x', now());
  UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
END;
$$;
