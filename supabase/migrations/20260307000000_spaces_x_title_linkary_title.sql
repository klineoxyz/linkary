-- XSpaces: x_title (exact X title, never overwrite) + linkary_title (optional internal title)
-- Sync-from-x sets x_title and title from X on insert; PATCH allows linkary_title only for display.

ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS x_title text;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS linkary_title text;

COMMENT ON COLUMN public.spaces.x_title IS 'Exact title from X at sync time; set once, never overwrite.';
COMMENT ON COLUMN public.spaces.linkary_title IS 'Optional internal title for Linkary UI; cards prefer this when set.';

-- Backfill: existing rows get x_title from title so display logic is consistent
UPDATE public.spaces SET x_title = title WHERE x_title IS NULL AND title IS NOT NULL;
