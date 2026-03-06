-- Slice 3: Sponsor proposals for XSpaces. No escrow; payout destination stored on accept.

CREATE TABLE IF NOT EXISTS public.space_sponsor_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  project_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  offer_amount numeric(18,4) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  sponsorship_type text NOT NULL CHECK (sponsorship_type IN ('title_sponsor','co_sponsor','giveaway_sponsor','speaking_slot_sponsor','custom')),
  message text,
  requested_deliverables text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  payout_method text,
  payout_wallet_address text,
  accepted_at timestamptz,
  accepted_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_space ON public.space_sponsor_proposals (space_id);
CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_project ON public.space_sponsor_proposals (project_profile_id);
CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_status ON public.space_sponsor_proposals (status);

-- One pending proposal per project per space
CREATE UNIQUE INDEX IF NOT EXISTS idx_space_sponsor_proposals_one_pending
  ON public.space_sponsor_proposals (space_id, project_profile_id)
  WHERE status = 'pending';

COMMENT ON TABLE public.space_sponsor_proposals IS 'Sponsor proposals for spaces; payout destination recorded on accept only. No escrow.';

ALTER TABLE public.space_sponsor_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "space_sponsor_proposals_select_host_or_project" ON public.space_sponsor_proposals;
CREATE POLICY "space_sponsor_proposals_select_host_or_project" ON public.space_sponsor_proposals FOR SELECT USING (
  project_profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_sponsor_proposals.space_id AND s.host_profile_id = auth.uid())
);

DROP POLICY IF EXISTS "space_sponsor_proposals_insert_own" ON public.space_sponsor_proposals;
CREATE POLICY "space_sponsor_proposals_insert_own" ON public.space_sponsor_proposals FOR INSERT WITH CHECK (project_profile_id = auth.uid());

DROP POLICY IF EXISTS "space_sponsor_proposals_update_host" ON public.space_sponsor_proposals;
CREATE POLICY "space_sponsor_proposals_update_host" ON public.space_sponsor_proposals FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_sponsor_proposals.space_id AND s.host_profile_id = auth.uid())
);
