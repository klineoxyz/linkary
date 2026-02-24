-- =============================================================================
-- XSpaces: spaces (host, title, scheduled_at, duration, status) + speaker_requests
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  scheduled_at timestamptz,
  duration_mins int,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spaces_host ON public.spaces (host_profile_id);
CREATE INDEX IF NOT EXISTS idx_spaces_scheduled ON public.spaces (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_spaces_status ON public.spaces (status);

CREATE TABLE IF NOT EXISTS public.speaker_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(space_id, requester_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_speaker_requests_space ON public.speaker_requests (space_id);
CREATE INDEX IF NOT EXISTS idx_speaker_requests_requester ON public.speaker_requests (requester_profile_id);

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speaker_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spaces_select_public" ON public.spaces;
CREATE POLICY "spaces_select_public" ON public.spaces FOR SELECT USING (true);

DROP POLICY IF EXISTS "spaces_insert_own" ON public.spaces;
CREATE POLICY "spaces_insert_own" ON public.spaces FOR INSERT WITH CHECK (host_profile_id = auth.uid());

DROP POLICY IF EXISTS "spaces_update_own" ON public.spaces;
CREATE POLICY "spaces_update_own" ON public.spaces FOR UPDATE USING (host_profile_id = auth.uid());

DROP POLICY IF EXISTS "spaces_delete_own" ON public.spaces;
CREATE POLICY "spaces_delete_own" ON public.spaces FOR DELETE USING (host_profile_id = auth.uid());

DROP POLICY IF EXISTS "speaker_requests_select" ON public.speaker_requests;
CREATE POLICY "speaker_requests_select" ON public.speaker_requests FOR SELECT USING (
  requester_profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = speaker_requests.space_id AND s.host_profile_id = auth.uid())
);

DROP POLICY IF EXISTS "speaker_requests_insert_own" ON public.speaker_requests;
CREATE POLICY "speaker_requests_insert_own" ON public.speaker_requests FOR INSERT WITH CHECK (requester_profile_id = auth.uid());

DROP POLICY IF EXISTS "speaker_requests_update_host_or_requester" ON public.speaker_requests;
CREATE POLICY "speaker_requests_update_host_or_requester" ON public.speaker_requests FOR UPDATE USING (
  requester_profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = speaker_requests.space_id AND s.host_profile_id = auth.uid())
);
