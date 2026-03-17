-- =============================================================================
-- CRM: Campaign definition extension (operator vs promoted vs social accounts).
-- - workspace_id = campaign operator / owner workspace (unchanged)
-- - promoted_org_id = project/client being promoted (Linkary org)
-- - promoted_social_handles = social accounts to track for growth/reporting
-- - New fields: reward_date, campaign_value_usd, token_or_usdt, required_platforms,
--   weekly_required_posts, daily_engagement_required
-- - crm_tasks.deliverable_type for structured task types (one_off, weekly_post, etc.)
-- =============================================================================

-- Campaign: reward and value
ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS reward_date timestamptz,
  ADD COLUMN IF NOT EXISTS campaign_value_usd numeric,
  ADD COLUMN IF NOT EXISTS token_or_usdt text;

COMMENT ON COLUMN public.crm_campaigns.reward_date IS 'When rewards are distributed.';
COMMENT ON COLUMN public.crm_campaigns.campaign_value_usd IS 'Campaign value in USD (e.g. total budget or prize pool).';
COMMENT ON COLUMN public.crm_campaigns.token_or_usdt IS 'Optional token name or USDT equivalent description.';

-- Campaign: required work
ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS required_platforms text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weekly_required_posts int,
  ADD COLUMN IF NOT EXISTS daily_engagement_required text;

COMMENT ON COLUMN public.crm_campaigns.required_platforms IS 'Platforms required for this campaign (e.g. x, youtube, tiktok).';
COMMENT ON COLUMN public.crm_campaigns.weekly_required_posts IS 'Weekly required original post count per creator.';
COMMENT ON COLUMN public.crm_campaigns.daily_engagement_required IS 'Description or rules for daily engagement requirements.';

-- Campaign: promoted project/client and social accounts to track
ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS promoted_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS promoted_social_handles jsonb DEFAULT '[]';

COMMENT ON COLUMN public.crm_campaigns.promoted_org_id IS 'Linkary org (project/client) being promoted. Reporting uses this + promoted_social_handles, not operator workspace accounts.';
COMMENT ON COLUMN public.crm_campaigns.promoted_social_handles IS 'Social accounts to track for growth/reporting. Array of { platform, handle } e.g. [{ "platform": "x", "handle": "@acme" }].';

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_promoted_org ON public.crm_campaigns(promoted_org_id)
  WHERE promoted_org_id IS NOT NULL;

-- Tasks: deliverable type (nullable for existing rows and sync)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'crm_tasks' AND column_name = 'deliverable_type'
  ) THEN
    ALTER TABLE public.crm_tasks
      ADD COLUMN deliverable_type text
      CHECK (deliverable_type IS NULL OR deliverable_type IN ('one_off', 'weekly_post', 'daily_engagement', 'custom'));
    COMMENT ON COLUMN public.crm_tasks.deliverable_type IS 'Structured deliverable type for campaign tasks.';
  END IF;
END $$;
