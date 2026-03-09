-- Allow any authenticated user to create an org/brand (remove account_type = company restriction).
-- Product rule: any user can create an org; creator becomes owner.

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

COMMENT ON FUNCTION public.create_org_and_membership(jsonb) IS 'Creates org and adds caller as owner. Any authenticated user may call. Slug auto-generated if blank.';
