-- MVP: KOL Lists — persisted reusable lists of creators (profiles). Owner = profile or org.

CREATE TABLE IF NOT EXISTS public.kol_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kol_lists_owner ON public.kol_lists (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_kol_lists_status ON public.kol_lists (status) WHERE status = 'active';

COMMENT ON TABLE public.kol_lists IS 'Reusable KOL/creator lists. Owned by profile or org.';

CREATE TABLE IF NOT EXISTS public.kol_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kol_list_id uuid NOT NULL REFERENCES public.kol_lists(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kol_list_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_kol_list_members_list ON public.kol_list_members (kol_list_id);
CREATE INDEX IF NOT EXISTS idx_kol_list_members_profile ON public.kol_list_members (profile_id);

COMMENT ON TABLE public.kol_list_members IS 'Profiles in a KOL list.';

ALTER TABLE public.kol_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kol_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY kol_lists_select_own
  ON public.kol_lists FOR SELECT
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = kol_lists.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY kol_lists_insert_own
  ON public.kol_lists FOR INSERT
  WITH CHECK (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = kol_lists.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY kol_lists_update_own
  ON public.kol_lists FOR UPDATE
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = kol_lists.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY kol_lists_delete_own
  ON public.kol_lists FOR DELETE
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = kol_lists.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY kol_list_members_select_own
  ON public.kol_list_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.kol_lists k
    WHERE k.id = kol_list_members.kol_list_id
    AND (
      (k.owner_type = 'profile' AND k.owner_id = auth.uid())
      OR (k.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = k.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

CREATE POLICY kol_list_members_insert_own
  ON public.kol_list_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.kol_lists k
    WHERE k.id = kol_list_members.kol_list_id
    AND (
      (k.owner_type = 'profile' AND k.owner_id = auth.uid())
      OR (k.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = k.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

CREATE POLICY kol_list_members_update_own
  ON public.kol_list_members FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.kol_lists k
    WHERE k.id = kol_list_members.kol_list_id
    AND (
      (k.owner_type = 'profile' AND k.owner_id = auth.uid())
      OR (k.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = k.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

CREATE POLICY kol_list_members_delete_own
  ON public.kol_list_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.kol_lists k
    WHERE k.id = kol_list_members.kol_list_id
    AND (
      (k.owner_type = 'profile' AND k.owner_id = auth.uid())
      OR (k.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = k.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

DROP TRIGGER IF EXISTS kol_lists_updated_at ON public.kol_lists;
CREATE TRIGGER kol_lists_updated_at
  BEFORE UPDATE ON public.kol_lists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
