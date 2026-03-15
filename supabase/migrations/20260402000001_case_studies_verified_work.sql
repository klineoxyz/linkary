-- Link case studies to verified work (org deal or gig deal) for proof-backed display.
-- Optional: when set, the case study is tied to a completed/verified collaboration.

ALTER TABLE public.case_studies
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gig_deal_id uuid REFERENCES public.gig_deals(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.case_studies.deal_id IS 'Optional: org deal this case study is proof for. Owner must be party to the deal.';
COMMENT ON COLUMN public.case_studies.gig_deal_id IS 'Optional: gig deal this case study is proof for. Owner must be party to the gig deal.';

CREATE INDEX IF NOT EXISTS idx_case_studies_deal_id ON public.case_studies (deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_studies_gig_deal_id ON public.case_studies (gig_deal_id) WHERE gig_deal_id IS NOT NULL;
