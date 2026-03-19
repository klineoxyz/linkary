-- /org/desicryptoclub vs orgs.slug = desicrypto-club: exact slug + usernames(org) miss;
-- usernames may hold the segment as a profile. Match orgs by slug with hyphens removed (unique only).
CREATE OR REPLACE FUNCTION public.resolve_org_public_by_segment(p_segment text)
RETURNS TABLE (id uuid, slug text, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_collapsed text;
  v_hyphen_count int;
BEGIN
  IF p_segment IS NULL THEN
    RETURN;
  END IF;
  v_norm := lower(trim(both from p_segment));
  v_norm := regexp_replace(v_norm, '^@', '');
  IF v_norm = '' THEN
    RETURN;
  END IF;

  IF v_norm ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN QUERY
    SELECT o.id, o.slug, o.name
    FROM public.orgs o
    WHERE o.id = v_norm::uuid
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT o.id, o.slug, o.name
  FROM public.orgs o
  WHERE lower(trim(both from o.slug)) = v_norm
  LIMIT 1;
  IF FOUND THEN
    RETURN;
  END IF;

  v_collapsed := replace(v_norm, '-', '');
  SELECT count(*)::int INTO v_hyphen_count
  FROM public.orgs o
  WHERE replace(lower(trim(both from o.slug)), '-', '') = v_collapsed;

  IF v_hyphen_count = 1 THEN
    RETURN QUERY
    SELECT o.id, o.slug, o.name
    FROM public.orgs o
    WHERE replace(lower(trim(both from o.slug)), '-', '') = v_collapsed
    LIMIT 1;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT o.id, o.slug, o.name
  FROM public.usernames u
  INNER JOIN public.orgs o ON o.id = u.owner_id
  WHERE u.owner_type = 'org'
    AND lower(trim(both from u.username)) = v_norm
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.resolve_org_public_by_segment(text) IS
  'Resolves org by URL segment: uuid, exact orgs.slug, hyphen-collapsed slug match (unique), or usernames(owner_type=org).';

REVOKE ALL ON FUNCTION public.resolve_org_public_by_segment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_org_public_by_segment(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_org_public_by_segment(text) TO authenticated;
