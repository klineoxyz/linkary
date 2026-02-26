-- Gigs (jobs) + gig_applications for projects/companies
-- Drop dependent FK from reviews first (reviews.gig_id -> gigs), then drop gigs so we can recreate with correct schema
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_gig_id_fkey;
DROP TABLE IF EXISTS public.gig_applications;
DROP TABLE IF EXISTS public.gigs;

CREATE TABLE public.gigs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  gig_type text NOT NULL CHECK (gig_type IN ('ambassador','affiliate','ugc','marketing','partnership','other')),
  compensation_type text NOT NULL CHECK (compensation_type IN ('paid','revshare','token','equity','unpaid','other')),
  budget_text text,
  location text,
  remote boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','filled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gigs_owner_created ON public.gigs (owner_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gigs_status_created ON public.gigs (status, created_at DESC);

ALTER TABLE public.gigs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gigs_owner_crud"
  ON public.gigs FOR ALL
  USING (owner_profile_id = auth.uid())
  WITH CHECK (owner_profile_id = auth.uid());

CREATE POLICY "gigs_public_select"
  ON public.gigs FOR SELECT
  USING (is_public = true AND status = 'open');

-- gig_applications
CREATE TABLE public.gig_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gig_id uuid NOT NULL REFERENCES public.gigs(id) ON DELETE CASCADE,
  applicant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text,
  case_study_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','accepted','rejected','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(gig_id, applicant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_gig_applications_gig_created ON public.gig_applications (gig_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_applications_applicant_created ON public.gig_applications (applicant_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gig_applications_status ON public.gig_applications (status);

ALTER TABLE public.gig_applications ENABLE ROW LEVEL SECURITY;

-- Applicant: create and read own
CREATE POLICY "gig_applications_applicant_insert"
  ON public.gig_applications FOR INSERT
  WITH CHECK (applicant_profile_id = auth.uid());

CREATE POLICY "gig_applications_applicant_select"
  ON public.gig_applications FOR SELECT
  USING (applicant_profile_id = auth.uid());

-- Gig owner: read applications for their gigs
CREATE POLICY "gig_applications_owner_select"
  ON public.gig_applications FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_applications.gig_id AND g.owner_profile_id = auth.uid())
  );

-- Applicant: update own to withdrawn only
CREATE POLICY "gig_applications_applicant_update"
  ON public.gig_applications FOR UPDATE
  USING (applicant_profile_id = auth.uid())
  WITH CHECK (applicant_profile_id = auth.uid());

-- Owner: update (accept/reject) - allowed when gig owner
CREATE POLICY "gig_applications_owner_update"
  ON public.gig_applications FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_applications.gig_id AND g.owner_profile_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.gigs g WHERE g.id = gig_applications.gig_id AND g.owner_profile_id = auth.uid())
  );

COMMENT ON TABLE public.gigs IS 'Project/company gigs (jobs). Public listing when is_public and status=open.';
COMMENT ON TABLE public.gig_applications IS 'Applications to gigs. Applicant can create/read/withdraw; owner can read and set accepted/rejected.';

-- Re-add FK from reviews to gigs if reviews has gig_id (restore dependency dropped above)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'gig_id') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_gig_id_fkey FOREIGN KEY (gig_id) REFERENCES public.gigs(id) ON DELETE SET NULL;
  END IF;
END $$;
