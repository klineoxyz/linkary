-- =============================================================================
-- Linkary: Proof-based username claiming (single namespace: profiles + orgs)
-- Source of truth: usernames table. profiles.username / orgs.slug are denormalized.
-- =============================================================================

-- =============================================================================
-- 1) usernames table (unique namespace)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.usernames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  provider text,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(username)
);

CREATE INDEX IF NOT EXISTS idx_usernames_owner ON public.usernames (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_usernames_username_lower ON public.usernames (LOWER(username));

COMMENT ON TABLE public.usernames IS 'Single namespace for usernames; proof (e.g. X connect) can set provider and verified_at';

ALTER TABLE public.usernames ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usernames_select_public" ON public.usernames;
CREATE POLICY "usernames_select_public" ON public.usernames FOR SELECT USING (true);

-- Inserts/updates only via SECURITY DEFINER RPC (no direct anon insert)

-- =============================================================================
-- 2) Normalize username to lowercase slug (alphanumeric + hyphen)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.normalize_username(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(trim(regexp_replace(coalesce(raw, ''), '^@', ''))),
      '[^a-z0-9\-]', '-', 'g'
    ),
    '-+', '-', 'g'
  );
$$;

-- =============================================================================
-- 3) claim_username_for_profile(desired_username text)
-- SECURITY DEFINER: runs as definer so it can update any profile/usernames row
-- Caller = auth.uid() (profile id = user id)
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
BEGIN
  profile_id := auth.uid();
  IF profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  normalized := public.normalize_username(desired_username);
  IF normalized = '' OR length(normalized) < 2 THEN
    RAISE EXCEPTION 'Invalid username';
  END IF;

  -- Already claimed by this profile?
  SELECT u.username, u.owner_type, u.owner_id, u.verified_at
    INTO existing
    FROM public.usernames u
    WHERE u.username = normalized
    LIMIT 1;

  IF NOT FOUND THEN
    -- Free: insert and update profile
    INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
    VALUES (normalized, 'profile', profile_id, 'x', now());
    UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
    RETURN;
  END IF;

  IF existing.owner_type = 'profile' AND existing.owner_id = profile_id THEN
    -- Already ours; ensure profile denormalized
    UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id;
    RETURN;
  END IF;

  -- Taken by someone else
  shortid := left(replace(gen_random_uuid()::text, '-', ''), 8);

  IF existing.owner_type = 'profile' THEN
    -- Check if that profile is unverified (placeholder)
    IF EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = existing.owner_id AND p.twitter_connected_at IS NULL
    ) THEN
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
    -- Org: consider unverified if verified_at is NULL on the claim
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
END;
$$;

COMMENT ON FUNCTION public.claim_username_for_profile(text) IS 'Claim a username for the current user (profile). Requires X proof. Unverified placeholders are renamed to test-* and reassigned.';

-- =============================================================================
-- 4) Optional: claim_username_for_org (for later; guarded by org ownership)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.claim_username_for_org(desired_username text, org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized text;
  existing record;
  shortid text;
  new_test_username text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = claim_username_for_org.org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not allowed to claim for this org';
  END IF;

  normalized := public.normalize_username(desired_username);
  IF normalized = '' OR length(normalized) < 2 THEN
    RAISE EXCEPTION 'Invalid username';
  END IF;

  SELECT u.username, u.owner_type, u.owner_id, u.verified_at INTO existing
  FROM public.usernames u WHERE u.username = normalized LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
    VALUES (normalized, 'org', org_id, NULL, NULL);
    UPDATE public.orgs SET slug = normalized, updated_at = now() WHERE id = org_id;
    RETURN;
  END IF;

  IF existing.owner_type = 'org' AND existing.owner_id = org_id THEN
    UPDATE public.orgs SET slug = normalized, updated_at = now() WHERE id = org_id;
    RETURN;
  END IF;

  shortid := left(replace(gen_random_uuid()::text, '-', ''), 8);

  IF existing.owner_type = 'profile' THEN
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = existing.owner_id AND p.twitter_connected_at IS NULL) THEN
      new_test_username := 'test-' || shortid;
      UPDATE public.usernames SET username = new_test_username WHERE username = normalized;
      UPDATE public.profiles SET username = new_test_username, updated_at = now() WHERE id = existing.owner_id;
      INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
      VALUES (normalized, 'org', org_id, NULL, NULL);
      UPDATE public.orgs SET slug = normalized, updated_at = now() WHERE id = org_id;
      RETURN;
    END IF;
  ELSIF existing.owner_type = 'org' AND existing.verified_at IS NULL THEN
    new_test_username := 'test-org-' || shortid;
    UPDATE public.usernames SET username = new_test_username WHERE username = normalized;
    UPDATE public.orgs SET slug = new_test_username, updated_at = now() WHERE id = existing.owner_id;
    INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
    VALUES (normalized, 'org', org_id, NULL, NULL);
    UPDATE public.orgs SET slug = normalized, updated_at = now() WHERE id = org_id;
    RETURN;
  END IF;

  RAISE EXCEPTION 'USERNAME_TAKEN_VERIFIED';
END;
$$;

COMMENT ON FUNCTION public.claim_username_for_org(text, uuid) IS 'Claim a username for an org (owner/admin). Unverified placeholders can be reassigned.';

-- Allow authenticated users to call claim (JWT from Supabase auth)
GRANT EXECUTE ON FUNCTION public.claim_username_for_profile(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_username_for_profile(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_username_for_org(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_username_for_org(text, uuid) TO service_role;
