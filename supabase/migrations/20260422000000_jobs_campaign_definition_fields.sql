-- =============================================================================
-- Jobs: campaign-definition fields for CRM execution (promoted entity, platforms,
-- handles, cadence). Linkary job/gig setup can store these; sync can map to CRM.
-- =============================================================================

-- Promoted org/client (e.g. SHIFT when DesiCryptoClub runs an ambassador campaign)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS promoted_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.jobs.promoted_org_id IS 'Org/project being promoted (when different from job org_id). E.g. agency runs campaign for client.';

-- Target social platforms (x first; youtube, tiktok, etc. later)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS required_platforms text[] DEFAULT '{}';
COMMENT ON COLUMN public.jobs.required_platforms IS 'Platforms required for this campaign (e.g. x, youtube, tiktok).';

-- Social handles to track (promoted brand accounts, not hiring org)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS promoted_social_handles jsonb DEFAULT '[]';
COMMENT ON COLUMN public.jobs.promoted_social_handles IS 'Social accounts to promote/track. Array of { platform, handle } e.g. [{ "platform": "x", "handle": "@client" }].';

-- Weekly posting cadence per creator
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS weekly_required_posts int;
COMMENT ON COLUMN public.jobs.weekly_required_posts IS 'Expected posts per creator per week (for campaign/sprint).';

-- Optional daily engagement (description)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS daily_engagement_required text;
COMMENT ON COLUMN public.jobs.daily_engagement_required IS 'Description or rules for daily engagement (e.g. like/comment).';

CREATE INDEX IF NOT EXISTS idx_jobs_promoted_org ON public.jobs(promoted_org_id) WHERE promoted_org_id IS NOT NULL;
