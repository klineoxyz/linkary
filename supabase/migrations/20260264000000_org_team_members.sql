-- org_team_members: team for company profiles (profile_type = 'company')
-- org_profile_id references profiles(id) so company profiles can have team members
BEGIN;

CREATE TABLE IF NOT EXISTS public.org_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  avatar_url text,
  linkedin_url text,
  x_url text,
  website_url text,
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_team_members_org_profile_id_sort
  ON public.org_team_members (org_profile_id, sort_order);

COMMENT ON TABLE public.org_team_members IS 'Team members for company profiles (profile_type=company). Only owner can CRUD.';

ALTER TABLE public.org_team_members ENABLE ROW LEVEL SECURITY;

-- Owner of the profile (profile.id = auth.uid()) can do everything
CREATE POLICY "org_team_members_all_own"
  ON public.org_team_members
  FOR ALL
  USING (org_profile_id = auth.uid());

-- Public can select only is_public members (for public profile page)
CREATE POLICY "org_team_members_select_public"
  ON public.org_team_members
  FOR SELECT
  USING (
    is_public = true
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = org_team_members.org_profile_id AND p.published = true
    )
  );

COMMIT;
