-- =============================================================================
-- Linkary: recompute_org_metrics(org_id) — company includes subsidiaries
-- =============================================================================

CREATE OR REPLACE FUNCTION public.recompute_org_metrics(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_type text;
  v_org_ids uuid[];
  v_profile_ids uuid[];
  v_combined_followers bigint := 0;
  v_weighted_engagement numeric := 0;
  v_total_followers numeric := 0;
  v_potential_reach bigint := 0;
  r record;
BEGIN
  SELECT org_type INTO v_org_type FROM public.orgs WHERE id = p_org_id;
  IF v_org_type IS NULL THEN
    RETURN;
  END IF;

  IF v_org_type = 'company' THEN
    -- Recursive: company + all descendant orgs
    WITH RECURSIVE descendants AS (
      SELECT id FROM public.orgs WHERE id = p_org_id
      UNION ALL
      SELECT o.id FROM public.orgs o
      INNER JOIN descendants d ON o.parent_org_id = d.id
    )
    SELECT array_agg(id) INTO v_org_ids FROM descendants;
  ELSE
    v_org_ids := array[p_org_id];
  END IF;

  -- Collect all profile ids from affiliates (active) and ambassadors (active) for these orgs
  SELECT array_agg(DISTINCT profile_id) INTO v_profile_ids
  FROM (
    SELECT profile_id FROM public.org_affiliations
    WHERE org_id = ANY(v_org_ids) AND status = 'active'
    UNION
    SELECT profile_id FROM public.org_ambassadors
    WHERE org_id = ANY(v_org_ids) AND status = 'active'
  ) x
  WHERE profile_id IS NOT NULL;

  IF v_profile_ids IS NULL OR array_length(v_profile_ids, 1) IS NULL THEN
    INSERT INTO public.org_metrics (org_id, combined_followers, avg_engagement_rate, potential_reach, updated_at)
    VALUES (p_org_id, 0, 0, 0, now())
    ON CONFLICT (org_id) DO UPDATE SET
      combined_followers = 0,
      avg_engagement_rate = 0,
      potential_reach = 0,
      updated_at = now();
    RETURN;
  END IF;

  FOR r IN
    SELECT
      coalesce(sum(followers_total), 0)::bigint AS total,
      coalesce(sum((followers_total::numeric) * coalesce(avg_engagement_rate, 0)), 0) AS weighted
    FROM public.profiles
    WHERE id = ANY(v_profile_ids)
  LOOP
    v_combined_followers := r.total;
    v_total_followers := r.total::numeric;
    IF v_total_followers > 0 THEN
      v_weighted_engagement := r.weighted / v_total_followers;
    END IF;
  END LOOP;

  v_potential_reach := round(v_combined_followers * coalesce(v_weighted_engagement, 0))::bigint;

  INSERT INTO public.org_metrics (org_id, combined_followers, avg_engagement_rate, potential_reach, updated_at)
  VALUES (p_org_id, v_combined_followers, v_weighted_engagement, v_potential_reach, now())
  ON CONFLICT (org_id) DO UPDATE SET
    combined_followers = v_combined_followers,
    avg_engagement_rate = v_weighted_engagement,
    potential_reach = v_potential_reach,
    updated_at = now();
END;
$$;

COMMENT ON FUNCTION public.recompute_org_metrics(uuid) IS 'Recalculates org_metrics for an org. For company type, includes all descendant orgs (recursive).';
