-- MVP: Creator programs (org-owned). Invite creators from circles or KOL lists; track status.

CREATE TABLE IF NOT EXISTS public.creator_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  program_type text CHECK (program_type IN ('ambassador', 'affiliate', 'campaign', 'other')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_creator_programs_org ON public.creator_programs (org_id);
CREATE INDEX IF NOT EXISTS idx_creator_programs_status ON public.creator_programs (status);

COMMENT ON TABLE public.creator_programs IS 'Org-owned programs to invite creators (from circles/KOL lists or manual).';

CREATE TABLE IF NOT EXISTS public.creator_program_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_program_id uuid NOT NULL REFERENCES public.creator_programs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type text CHECK (source_type IN ('circle', 'kol_list', 'manual')),
  source_id uuid,
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'applied', 'active', 'removed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (creator_program_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_creator_program_invites_program ON public.creator_program_invites (creator_program_id);
CREATE INDEX IF NOT EXISTS idx_creator_program_invites_profile ON public.creator_program_invites (profile_id);

COMMENT ON TABLE public.creator_program_invites IS 'Creators invited to a program. source_type/source_id optional (circle_id or kol_list_id).';

ALTER TABLE public.creator_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_program_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY creator_programs_select_org
  ON public.creator_programs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = creator_programs.org_id AND user_id = auth.uid()
  ));

CREATE POLICY creator_programs_insert_org
  ON public.creator_programs FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = creator_programs.org_id AND user_id = auth.uid()
  ));

CREATE POLICY creator_programs_update_org
  ON public.creator_programs FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = creator_programs.org_id AND user_id = auth.uid()
  ));

CREATE POLICY creator_programs_delete_org
  ON public.creator_programs FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = creator_programs.org_id AND user_id = auth.uid()
  ));

CREATE POLICY creator_program_invites_select_org
  ON public.creator_program_invites FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_programs cp
      JOIN public.org_members om ON om.org_id = cp.org_id AND om.user_id = auth.uid()
      WHERE cp.id = creator_program_invites.creator_program_id
    )
    OR profile_id = auth.uid()
  );

CREATE POLICY creator_program_invites_insert_org
  ON public.creator_program_invites FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.creator_programs cp
    JOIN public.org_members om ON om.org_id = cp.org_id AND om.user_id = auth.uid()
    WHERE cp.id = creator_program_invites.creator_program_id
  ));

CREATE POLICY creator_program_invites_update_org_or_invitee
  ON public.creator_program_invites FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.creator_programs cp
      JOIN public.org_members om ON om.org_id = cp.org_id AND om.user_id = auth.uid()
      WHERE cp.id = creator_program_invites.creator_program_id
    )
    OR profile_id = auth.uid()
  );

CREATE POLICY creator_program_invites_delete_org
  ON public.creator_program_invites FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.creator_programs cp
    JOIN public.org_members om ON om.org_id = cp.org_id AND om.user_id = auth.uid()
    WHERE cp.id = creator_program_invites.creator_program_id
  ));

DROP TRIGGER IF EXISTS creator_programs_updated_at ON public.creator_programs;
CREATE TRIGGER creator_programs_updated_at
  BEFORE UPDATE ON public.creator_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS creator_program_invites_updated_at ON public.creator_program_invites;
CREATE TRIGGER creator_program_invites_updated_at
  BEFORE UPDATE ON public.creator_program_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
