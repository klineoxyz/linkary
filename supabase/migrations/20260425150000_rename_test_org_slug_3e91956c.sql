-- Rename legacy test org slug to a brand-like slug for cleaner public URLs.
-- Targets current known legacy slug from production screenshot: test-org-3e91956c.
DO $$
DECLARE
  v_old_slug text := 'test-org-3e91956c';
  v_org_id uuid;
  v_name text;
  v_base text;
  v_candidate text;
  v_short text := '3e91956c';
BEGIN
  SELECT id, name
  INTO v_org_id, v_name
  FROM public.orgs
  WHERE lower(slug) = v_old_slug
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN;
  END IF;

  v_base := lower(trim(coalesce(v_name, '')));
  v_base := regexp_replace(v_base, '\s+', '-', 'g');
  v_base := regexp_replace(v_base, '[^a-z0-9\-]', '', 'g');
  v_base := regexp_replace(v_base, '\-+', '-', 'g');
  v_base := trim(both '-' from v_base);
  IF length(v_base) < 2 THEN
    v_base := 'org';
  END IF;

  v_candidate := v_base;
  IF EXISTS (
    SELECT 1
    FROM public.usernames u
    WHERE u.username = v_candidate
      AND NOT (u.owner_type = 'org' AND u.owner_id = v_org_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.orgs o
    WHERE lower(o.slug) = v_candidate
      AND o.id <> v_org_id
  ) THEN
    v_candidate := v_base || '-' || v_short;
  END IF;

  UPDATE public.orgs
  SET slug = v_candidate
  WHERE id = v_org_id;

  IF EXISTS (
    SELECT 1 FROM public.usernames
    WHERE owner_type = 'org' AND owner_id = v_org_id
  ) THEN
    UPDATE public.usernames
    SET username = v_candidate
    WHERE owner_type = 'org' AND owner_id = v_org_id;
  ELSE
    INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
    VALUES (v_candidate, 'org', v_org_id, NULL, NULL);
  END IF;
END
$$;
