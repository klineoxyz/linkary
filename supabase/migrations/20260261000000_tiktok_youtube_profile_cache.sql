-- Phase 5: TikTok and YouTube profile cache tables (unified insights).
-- One row per profile; JSON payload. RLS enabled, no policies (service-only).

CREATE TABLE IF NOT EXISTS public.tiktok_profile_cache (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tiktok_profile_cache IS 'Cached TikTok insights per profile; service role only.';

CREATE TABLE IF NOT EXISTS public.youtube_profile_cache (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.youtube_profile_cache IS 'Cached YouTube insights per profile; service role only.';

ALTER TABLE public.tiktok_profile_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_profile_cache ENABLE ROW LEVEL SECURITY;
