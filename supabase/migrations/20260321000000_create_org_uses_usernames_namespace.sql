-- =============================================================================
-- Phase 2: Enforce global namespace at org creation.
-- create_org_and_membership now checks usernames before assigning a slug and
-- inserts into usernames on success. See LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md.
-- =============================================================================

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
  slug_provided boolean;
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
  slug_provided := (base_slug <> '');
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

  IF slug_provided THEN
    -- Explicit slug: must not be taken in global namespace (usernames)
    IF EXISTS (SELECT 1 FROM public.usernames WHERE username = candidate_slug) THEN
      RAISE EXCEPTION 'SLUG_TAKEN';
    END IF;
    -- Also ensure not in orgs (legacy consistency)
    IF EXISTS (SELECT 1 FROM public.orgs WHERE LOWER(slug) = candidate_slug) THEN
      RAISE EXCEPTION 'SLUG_TAKEN';
    END IF;
    o_slug := candidate_slug;
  ELSE
    -- Auto slug from name: find first candidate free in both usernames and orgs
    WHILE EXISTS (SELECT 1 FROM public.usernames WHERE username = candidate_slug)
       OR EXISTS (SELECT 1 FROM public.orgs WHERE LOWER(slug) = candidate_slug) LOOP
      suffix := suffix + 1;
      candidate_slug := base_slug || '-' || suffix;
    END LOOP;
    o_slug := candidate_slug;
  END IF;

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

  -- Global namespace: org owns this slug
  INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
  VALUES (o_slug, 'org', new_org.id, NULL, NULL);

  RETURN new_org;
END;
$$;

COMMENT ON FUNCTION public.create_org_and_membership(jsonb) IS 'Creates org and adds caller as owner. Slug is checked and registered in usernames (global namespace). Fails with SLUG_TAKEN if explicit slug is taken by profile or org.';
