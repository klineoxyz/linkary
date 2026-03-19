-- Campaign objective and guidance links (from Linkary job/sync).
ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS campaign_objective text;
ALTER TABLE public.crm_campaigns ADD COLUMN IF NOT EXISTS guidance_links jsonb DEFAULT '[]';
COMMENT ON COLUMN public.crm_campaigns.campaign_objective IS 'Campaign objective/focus from Linkary job (e.g. awareness, repost campaign).';
COMMENT ON COLUMN public.crm_campaigns.guidance_links IS 'Labeled URLs for creators to follow. Array of { label, url } from Linkary job.';
