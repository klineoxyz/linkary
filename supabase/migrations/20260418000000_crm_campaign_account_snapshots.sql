-- =============================================================================
-- CRM: Promoted-account snapshots for growth tracking and reporting.
-- Keyed by campaign_id + (platform, handle) from promoted_social_handles.
-- Baseline at campaign start, daily/periodic during campaign, end at campaign end.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.crm_campaign_account_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  platform text NOT NULL,
  handle text NOT NULL,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('baseline', 'daily', 'end')),
  snapshot_at timestamptz NOT NULL,
  metrics jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.crm_campaign_account_snapshots IS 'Per-account snapshots for promoted_social_handles: followers, views, likes, replies, quotes, reposts, engagement. Key: campaign_id + platform + handle.';
COMMENT ON COLUMN public.crm_campaign_account_snapshots.snapshot_type IS 'baseline = campaign start; daily = periodic; end = campaign end.';
COMMENT ON COLUMN public.crm_campaign_account_snapshots.metrics IS 'JSON: followers, views, likes, replies, quotes, reposts, engagement_total (stored data only).';

CREATE INDEX IF NOT EXISTS idx_crm_campaign_account_snapshots_campaign ON public.crm_campaign_account_snapshots(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_campaign_account_snapshots_lookup ON public.crm_campaign_account_snapshots(campaign_id, platform, handle, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_crm_campaign_account_snapshots_at ON public.crm_campaign_account_snapshots(campaign_id, snapshot_at);

-- RLS: workspace members of the campaign can select/insert
ALTER TABLE public.crm_campaign_account_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_campaign_account_snapshots_select" ON public.crm_campaign_account_snapshots;
CREATE POLICY "crm_campaign_account_snapshots_select" ON public.crm_campaign_account_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "crm_campaign_account_snapshots_insert" ON public.crm_campaign_account_snapshots;
CREATE POLICY "crm_campaign_account_snapshots_insert" ON public.crm_campaign_account_snapshots
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "crm_campaign_account_snapshots_update" ON public.crm_campaign_account_snapshots;
CREATE POLICY "crm_campaign_account_snapshots_update" ON public.crm_campaign_account_snapshots
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );
