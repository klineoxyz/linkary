-- MVP: Circles — persisted lists of creators/profiles. Owner = profile or org.
-- Used for building creator networks and later inviting to creator programs.

CREATE TABLE IF NOT EXISTS public.circles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'shareable', 'invite-only')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_circles_owner ON public.circles (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_circles_status ON public.circles (status) WHERE status = 'active';

COMMENT ON TABLE public.circles IS 'Curated lists of creators (profiles). Owned by profile or org.';
COMMENT ON COLUMN public.circles.owner_type IS 'profile = personal circle; org = organization circle.';
COMMENT ON COLUMN public.circles.owner_id IS 'profiles.id or orgs.id depending on owner_type.';

CREATE TABLE IF NOT EXISTS public.circle_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id uuid NOT NULL REFERENCES public.circles(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (circle_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_circle_members_circle ON public.circle_members (circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_profile ON public.circle_members (profile_id);

COMMENT ON TABLE public.circle_members IS 'Profiles in a circle. One row per circle+profile.';

ALTER TABLE public.circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.circle_members ENABLE ROW LEVEL SECURITY;

-- RLS: owner can do everything. Profile owner = owner_id = auth.uid(). Org owner = caller in org_members.
CREATE POLICY circles_select_own
  ON public.circles FOR SELECT
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = circles.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY circles_insert_own
  ON public.circles FOR INSERT
  WITH CHECK (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = circles.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY circles_update_own
  ON public.circles FOR UPDATE
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = circles.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY circles_delete_own
  ON public.circles FOR DELETE
  USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = circles.owner_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY circle_members_select_own
  ON public.circle_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = circle_members.circle_id
    AND (
      (c.owner_type = 'profile' AND c.owner_id = auth.uid())
      OR (c.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = c.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

CREATE POLICY circle_members_insert_own
  ON public.circle_members FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = circle_members.circle_id
    AND (
      (c.owner_type = 'profile' AND c.owner_id = auth.uid())
      OR (c.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = c.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

CREATE POLICY circle_members_delete_own
  ON public.circle_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.circles c
    WHERE c.id = circle_members.circle_id
    AND (
      (c.owner_type = 'profile' AND c.owner_id = auth.uid())
      OR (c.owner_type = 'org' AND EXISTS (
        SELECT 1 FROM public.org_members om
        WHERE om.org_id = c.owner_id AND om.user_id = auth.uid()
      ))
    )
  ));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS circles_updated_at ON public.circles;
CREATE TRIGGER circles_updated_at
  BEFORE UPDATE ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
