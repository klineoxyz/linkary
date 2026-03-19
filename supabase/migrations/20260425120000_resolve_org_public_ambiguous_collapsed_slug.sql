-- When multiple orgs share the same hyphen-stripped slug (e.g. desicryptoclub vs desi-crypto-club),
-- the previous logic returned no row (v_hyphen_count <> 1) → /org/[segment] 404.
-- Pick deterministically: exact lower(slug)=segment first, then shortest slug, then newest, then id.
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

  RETURN QUERY
  SELECT o.id, o.slug, o.name
  FROM public.orgs o
  WHERE replace(lower(trim(both from o.slug)), '-', '') = v_collapsed
  ORDER BY
    (lower(trim(both from o.slug)) = v_norm) DESC,
    length(trim(both from o.slug)) ASC,
    o.created_at DESC,
    o.id ASC
  LIMIT 1;
  IF FOUND THEN
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
  'Resolves org by URL segment: uuid, exact orgs.slug, hyphen-collapsed slug (deterministic tie-break), or usernames(owner_type=org).';

REVOKE ALL ON FUNCTION public.resolve_org_public_by_segment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_org_public_by_segment(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_org_public_by_segment(text) TO authenticated;
