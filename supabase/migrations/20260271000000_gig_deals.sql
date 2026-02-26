-- Verified Deals v1: gig-based deals (owner + participant profiles). Created when gig owner accepts an application.
-- Table name: gig_deals (existing public.deals is org↔profile job deals).

CREATE TABLE IF NOT EXISTS public.gig_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gig_id, participant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_deals_owner_created ON public.gig_deals (owner_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_deals_participant_created ON public.gig_deals (participant_profile_id, created_at DESC);

COMMENT ON TABLE public.gig_deals IS 'Deals from gig applications: created when gig owner accepts. Used for verified reviews.';

ALTER TABLE public.gig_deals ENABLE ROW LEVEL SECURITY;

-- Owner: full read/write on own deals
CREATE POLICY "gig_deals_owner_all"
  ON public.gig_deals FOR ALL
  USING (owner_profile_id = auth.uid())
  WITH CHECK (owner_profile_id = auth.uid());

-- Participant: read only
CREATE POLICY "gig_deals_participant_select"
  ON public.gig_deals FOR SELECT
  USING (participant_profile_id = auth.uid());

-- Only owner can change status to completed/cancelled (enforced in API; RLS allows owner UPDATE)
-- No separate policy needed: owner_all already allows UPDATE for owner.
