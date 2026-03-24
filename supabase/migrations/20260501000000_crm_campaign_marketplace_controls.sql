-- =============================================================================
-- CRM campaigns: explicit marketplace/public controls
-- Minimal, reversible extension for CRM -> marketplace surfacing.
-- =============================================================================

ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS marketplace_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketplace_category text NOT NULL DEFAULT 'creator_programs'
    CHECK (marketplace_category IN ('creator_programs')),
  ADD COLUMN IF NOT EXISTS visibility_mode text NOT NULL DEFAULT 'private_hidden'
    CHECK (visibility_mode IN ('public', 'invite_only', 'private_hidden')),
  ADD COLUMN IF NOT EXISTS accepting_new_users boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS public_summary text;

-- Backfill existing rows to explicit, safe defaults.
UPDATE public.crm_campaigns
SET
  marketplace_enabled = COALESCE(marketplace_enabled, false),
  marketplace_category = COALESCE(NULLIF(marketplace_category, ''), 'creator_programs'),
  visibility_mode = COALESCE(NULLIF(visibility_mode, ''), 'private_hidden'),
  accepting_new_users = COALESCE(accepting_new_users, true),
  public_summary = COALESCE(NULLIF(public_summary, ''), description)
WHERE true;

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_marketplace_enabled
  ON public.crm_campaigns(marketplace_enabled)
  WHERE marketplace_enabled = true;

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_marketplace_visibility
  ON public.crm_campaigns(visibility_mode);
