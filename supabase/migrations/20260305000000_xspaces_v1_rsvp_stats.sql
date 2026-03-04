-- XSpaces V1: x_space_url on spaces, message on speaker_requests, Linkary RSVPs, space_stats for past stats.

-- 1) spaces: optional X Space URL (Phase 2: link to X)
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS x_space_url text;
COMMENT ON COLUMN public.spaces.x_space_url IS 'Optional X (Twitter) Space URL when host links or creates on X.';

-- 2) speaker_requests: optional message from requester; updated_at for resolve
ALTER TABLE public.speaker_requests ADD COLUMN IF NOT EXISTS message text;
ALTER TABLE public.speaker_requests ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3) space_rsvps: Linkary-native RSVP (interested | going). One row per (space_id, profile_id).
CREATE TABLE IF NOT EXISTS public.space_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'interested' CHECK (status IN ('interested', 'going')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(space_id, profile_id)
);
CREATE INDEX IF NOT EXISTS idx_space_rsvps_space ON public.space_rsvps (space_id);
CREATE INDEX IF NOT EXISTS idx_space_rsvps_profile ON public.space_rsvps (profile_id);
ALTER TABLE public.space_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "space_rsvps_select_public" ON public.space_rsvps;
CREATE POLICY "space_rsvps_select_public" ON public.space_rsvps FOR SELECT USING (true);

DROP POLICY IF EXISTS "space_rsvps_insert_own" ON public.space_rsvps;
CREATE POLICY "space_rsvps_insert_own" ON public.space_rsvps FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "space_rsvps_update_own" ON public.space_rsvps;
CREATE POLICY "space_rsvps_update_own" ON public.space_rsvps FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "space_rsvps_delete_own" ON public.space_rsvps;
CREATE POLICY "space_rsvps_delete_own" ON public.space_rsvps FOR DELETE USING (profile_id = auth.uid());

-- 4) space_stats: past space stats (listeners, peak, duration; Phase 2 can backfill from X API)
CREATE TABLE IF NOT EXISTS public.space_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  listeners_total int,
  peak_listeners int,
  speakers_count int,
  duration_seconds int,
  recorded bool,
  raw_json jsonb,
  captured_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_space_stats_space ON public.space_stats (space_id);
ALTER TABLE public.space_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "space_stats_select_public" ON public.space_stats;
CREATE POLICY "space_stats_select_public" ON public.space_stats FOR SELECT USING (true);

DROP POLICY IF EXISTS "space_stats_insert_host_or_service" ON public.space_stats;
CREATE POLICY "space_stats_insert_host_or_service" ON public.space_stats FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_stats.space_id AND s.host_profile_id = auth.uid())
);

COMMENT ON TABLE public.space_rsvps IS 'Linkary-native RSVP: interested/going per profile per space.';
COMMENT ON TABLE public.space_stats IS 'Past space stats; Phase 2 can ingest from X API.';
