-- Optional: campaign finalized_at for finalize/reward snapshot.
-- When set, contribution can be treated as frozen for reward reporting.
ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

COMMENT ON COLUMN public.crm_campaigns.finalized_at IS 'When campaign was finalized; contribution/reward snapshot is from this time.';
