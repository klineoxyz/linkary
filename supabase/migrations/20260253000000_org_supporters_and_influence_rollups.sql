-- =============================================================================
-- Org supporters (profile supports org) + org_influence_rollups (cached influence + breakdown)
-- =============================================================================

-- 1) org_supporters: profile supports a project/org
CREATE TABLE IF NOT EXISTS public.org_supporters (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_supporters_org_id ON public.org_supporters (org_id);
CREATE INDEX IF NOT EXISTS idx_org_supporters_profile_id ON public.org_supporters (profile_id);

COMMENT ON TABLE public.org_supporters IS 'Profiles that support this org; used in influence rollup and UI';

ALTER TABLE public.org_supporters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_supporters_select_public" ON public.org_supporters;
CREATE POLICY "org_supporters_select_public" ON public.org_supporters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "org_supporters_insert_own" ON public.org_supporters;
CREATE POLICY "org_supporters_insert_own" ON public.org_supporters
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "org_supporters_delete_own" ON public.org_supporters;
CREATE POLICY "org_supporters_delete_own" ON public.org_supporters
  FOR DELETE USING (profile_id = auth.uid());

-- 2) org_influence_rollups: cached total_influence + breakdown (ambassadors, affiliates, supporters, subsidiaries)
CREATE TABLE IF NOT EXISTS public.org_influence_rollups (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  total_influence numeric NOT NULL DEFAULT 0,
  breakdown jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_influence_rollups_computed_at ON public.org_influence_rollups (computed_at);

COMMENT ON TABLE public.org_influence_rollups IS 'Cached org influence from computeLinkaryInfluence + supporters; refreshed by worker or on supporter/ambassador/affiliate/subsidiary change';

ALTER TABLE public.org_influence_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_influence_rollups_select_public" ON public.org_influence_rollups;
CREATE POLICY "org_influence_rollups_select_public" ON public.org_influence_rollups
  FOR SELECT USING (true);
