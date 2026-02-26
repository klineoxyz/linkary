-- Unified profile relations: ambassador, affiliate, ecosystem, subsidiary
CREATE TABLE IF NOT EXISTS public.profile_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  relation_type text NOT NULL CHECK (relation_type IN ('ambassador','affiliate','ecosystem','subsidiary')),
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_profile_id, target_profile_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_profile_relations_source_type_order
  ON public.profile_relations (source_profile_id, relation_type, sort_order);

CREATE INDEX IF NOT EXISTS idx_profile_relations_target_type_order
  ON public.profile_relations (target_profile_id, relation_type, sort_order);

ALTER TABLE public.profile_relations ENABLE ROW LEVEL SECURITY;

-- Owners manage rows where they are the source
CREATE POLICY "profile_relations_own_source"
  ON public.profile_relations
  FOR ALL
  USING (source_profile_id = auth.uid())
  WITH CHECK (source_profile_id = auth.uid());

-- Public read: only is_public rows (for public profile page)
CREATE POLICY "profile_relations_public_read"
  ON public.profile_relations
  FOR SELECT
  USING (is_public = true);

COMMENT ON TABLE public.profile_relations IS 'Unified relations: ambassador, affiliate, ecosystem, subsidiary. Source/target are profile ids.';
