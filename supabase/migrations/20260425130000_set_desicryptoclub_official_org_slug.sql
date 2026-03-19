-- Make desicryptoclub the canonical stored slug for the DesiCrypto Club org.
-- If another org already owns that slug, move it aside first to preserve unique(lower(slug)).
DO $$
DECLARE
  v_target_org_id uuid := 'ea3d34eb-123e-4096-ac2f-04d1db9ea2c2';
  v_desired_slug text := 'desicryptoclub';
  v_conflict_id uuid;
  v_conflict_new_slug text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.orgs
    WHERE id = v_target_org_id
  ) THEN
    RAISE EXCEPTION 'Target org not found: %', v_target_org_id;
  END IF;

  SELECT o.id
  INTO v_conflict_id
  FROM public.orgs o
  WHERE lower(trim(both from o.slug)) = lower(v_desired_slug)
    AND o.id <> v_target_org_id
  LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    v_conflict_new_slug := format(
      '%s-legacy-%s',
      v_desired_slug,
      substr(replace(v_conflict_id::text, '-', ''), 1, 8)
    );

    UPDATE public.orgs
    SET slug = v_conflict_new_slug
    WHERE id = v_conflict_id;
  END IF;

  UPDATE public.orgs
  SET slug = v_desired_slug
  WHERE id = v_target_org_id;
END
$$;
