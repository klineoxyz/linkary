-- Ensure profiles.published is NOT NULL DEFAULT false for publish gating and sitemap.
-- Idempotent: only alters if column allows NULL or has no default.

DO $$
BEGIN
  -- Set default if not already false
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'published'
  ) THEN
    ALTER TABLE public.profiles ALTER COLUMN published SET DEFAULT false;
    UPDATE public.profiles SET published = false WHERE published IS NULL;
    ALTER TABLE public.profiles ALTER COLUMN published SET NOT NULL;
  END IF;
END $$;
