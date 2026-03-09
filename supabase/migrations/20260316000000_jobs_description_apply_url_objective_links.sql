-- Add description, apply_url (external apply link), objective (for sprints), and links (for sprints) to jobs.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS apply_url text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS objective text;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS links jsonb DEFAULT '[]';

COMMENT ON COLUMN public.jobs.description IS 'Job requirements and description (for type=job).';
COMMENT ON COLUMN public.jobs.apply_url IS 'When set, Apply button opens this URL (e.g. external job post) instead of in-app apply.';
COMMENT ON COLUMN public.jobs.objective IS 'Campaign/project objective (for type=sprint).';
COMMENT ON COLUMN public.jobs.links IS 'Array of { label, url } for creators to click (for type=sprint).';
