-- v1 handshake: accepted collab_request can be converted into verified work (gig_deal).
-- One conversion per request; no review/case study until gig_deal is completed.

-- Link gig_deal back to collab_request (at most one gig_deal per request)
ALTER TABLE public.gig_deals
  ADD COLUMN IF NOT EXISTS collab_request_id uuid REFERENCES public.collab_requests(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gig_deals_collab_request_id
  ON public.gig_deals (collab_request_id)
  WHERE collab_request_id IS NOT NULL;

COMMENT ON COLUMN public.gig_deals.collab_request_id IS 'Set when this deal was created from an accepted collab request; at most one deal per request.';

-- Quick lookup from collab_request to converted deal (for inbox UI)
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS converted_gig_deal_id uuid REFERENCES public.gig_deals(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.collab_requests.converted_gig_deal_id IS 'Set when this accepted request has been converted to verified work (gig_deal).';
