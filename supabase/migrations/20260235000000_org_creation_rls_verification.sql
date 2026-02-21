-- =============================================================================
-- Org creation: fix org_members RLS recursion, add owner_profile_id,
-- X verification columns, publish gate, create_org_and_membership RPC.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Add orgs.owner_profile_id (single source of truth for org owner; no recursion)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'owner_profile_id'
  ) THEN
    ALTER TABLE public.orgs ADD COLUMN owner_profile_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.orgs.owner_profile_id IS 'Profile (user) that owns the org. Used for RLS to avoid org_members recursion.';
  END IF;
END $$;

-- Backfill from created_by or first owner in org_members
UPDATE public.orgs o
SET owner_profile_id = COALESCE(o.created_by, (
  SELECT m.user_id FROM public.org_members m WHERE m.org_id = o.id AND m.role = 'owner' LIMIT 1
))
WHERE o.owner_profile_id IS NULL;

-- -----------------------------------------------------------------------------
-- 2) Add org X verification columns (required for publish)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'x_account_username') THEN
    ALTER TABLE public.orgs ADD COLUMN x_account_username text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'x_account_user_id') THEN
    ALTER TABLE public.orgs ADD COLUMN x_account_user_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'x_connected_at') THEN
    ALTER TABLE public.orgs ADD COLUMN x_connected_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'is_x_verified') THEN
    ALTER TABLE public.orgs ADD COLUMN is_x_verified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

COMMENT ON COLUMN public.orgs.x_account_username IS 'X (Twitter) handle connected for this org (ownership verification).';
COMMENT ON COLUMN public.orgs.x_account_user_id IS 'X provider user id for the connected org account.';
COMMENT ON COLUMN public.orgs.x_connected_at IS 'When the org X account was connected.';
COMMENT ON COLUMN public.orgs.is_x_verified IS 'True only after org X account connected via OAuth. Required for published = true.';

-- -----------------------------------------------------------------------------
-- 3) Publish gate: published can only be true when is_x_verified = true
-- -----------------------------------------------------------------------------
ALTER TABLE public.orgs DROP CONSTRAINT IF EXISTS orgs_published_requires_x_verified;
ALTER TABLE public.orgs ADD CONSTRAINT orgs_published_requires_x_verified
  CHECK (published IS FALSE OR (published = true AND is_x_verified = true));

-- -----------------------------------------------------------------------------
-- 4) Replace org_members RLS policies (no recursion: use orgs.owner_profile_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select_members" ON public.org_members;
DROP POLICY IF EXISTS "org_members_insert_owner" ON public.org_members;
DROP POLICY IF EXISTS "org_members_update_owner" ON public.org_members;
DROP POLICY IF EXISTS "org_members_delete_owner" ON public.org_members;

-- SELECT: user can see their own memberships only (no subquery on org_members)
CREATE POLICY "org_members_select_own" ON public.org_members
  FOR SELECT USING (user_id = auth.uid());

-- INSERT: only org owner (by orgs.owner_profile_id) can add members; RPC will add first owner
CREATE POLICY "org_members_insert_by_owner" ON public.org_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND role IN ('owner', 'admin', 'member')
    AND (SELECT o.owner_profile_id FROM public.orgs o WHERE o.id = org_id) = auth.uid()
  );

-- UPDATE: own row or org owner
CREATE POLICY "org_members_update_own_or_owner" ON public.org_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR (SELECT o.owner_profile_id FROM public.orgs o WHERE o.id = org_id) = auth.uid()
  );

-- DELETE: own row or org owner
CREATE POLICY "org_members_delete_own_or_owner" ON public.org_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR (SELECT o.owner_profile_id FROM public.orgs o WHERE o.id = org_id) = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- 5) Orgs UPDATE policy: keep owner/admin check (uses org_members; no recursion)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "orgs_update_owner_admin" ON public.orgs;
CREATE POLICY "orgs_update_owner_admin" ON public.orgs
  FOR UPDATE USING (
    owner_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = orgs.id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- 6) create_org_and_membership RPC (SECURITY DEFINER, atomic)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_org_and_membership(payload jsonb)
RETURNS public.orgs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  o_name text;
  o_type text;
  o_slug text;
  o_tagline text;
  o_website text;
  o_twitter text;
  o_logo text;
  o_parent uuid;
  base_slug text;
  candidate_slug text;
  suffix int;
  new_org public.orgs;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  o_name := NULLIF(TRIM(payload->>'name'), '');
  o_type := NULLIF(TRIM(LOWER(payload->>'org_type')), '');
  IF o_name IS NULL THEN
    RAISE EXCEPTION 'name is required';
  END IF;
  IF o_type IS NULL OR o_type NOT IN ('company', 'brand', 'project', 'agency') THEN
    RAISE EXCEPTION 'org_type must be one of: company, brand, project, agency';
  END IF;

  o_tagline := NULLIF(TRIM(payload->>'tagline'), '');
  o_website := NULLIF(TRIM(payload->>'website'), '');
  o_twitter := NULLIF(TRIM(BOTH '@' FROM TRIM(payload->>'twitter_username')), '');
  o_logo := NULLIF(TRIM(payload->>'logo_url'), '');
  o_parent := (payload->>'parent_org_id')::uuid;

  base_slug := TRIM(LOWER(payload->>'slug'));
  IF base_slug = '' THEN
    base_slug := REGEXP_REPLACE(LOWER(o_name), '\s+', '-', 'g');
    base_slug := REGEXP_REPLACE(base_slug, '[^a-z0-9\-]', '', 'g');
    IF LENGTH(base_slug) < 2 THEN
      base_slug := 'org-' || SUBSTR(MD5(o_name || uid::text), 1, 8);
    END IF;
  ELSE
    base_slug := REGEXP_REPLACE(base_slug, '[^a-z0-9\-]', '', 'g');
    IF LENGTH(base_slug) < 2 THEN
      RAISE EXCEPTION 'slug too short after sanitization';
    END IF;
  END IF;

  candidate_slug := base_slug;
  suffix := 0;
  WHILE EXISTS (SELECT 1 FROM public.orgs WHERE LOWER(slug) = candidate_slug) LOOP
    suffix := suffix + 1;
    candidate_slug := base_slug || '-' || suffix;
  END LOOP;
  o_slug := candidate_slug;

  INSERT INTO public.orgs (
    slug, name, tagline, website, twitter_username, logo_url, org_type, parent_org_id,
    created_by, owner_profile_id, published, is_x_verified, updated_at
  ) VALUES (
    o_slug, o_name, o_tagline, o_website, o_twitter, o_logo, o_type, o_parent,
    uid, uid, false, false, now()
  )
  RETURNING * INTO new_org;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (new_org.id, uid, 'owner');

  RETURN new_org;
END;
$$;

COMMENT ON FUNCTION public.create_org_and_membership(jsonb) IS 'Creates org and adds caller as owner. Slug auto-generated if blank; unique by suffix. Org is unverified and unpublished until X is connected.';

-- -----------------------------------------------------------------------------
-- 7) Indexes for verification and owner lookups
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orgs_owner_profile_id ON public.orgs (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_orgs_is_x_verified ON public.orgs (is_x_verified);

COMMIT;
