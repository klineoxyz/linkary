-- XSpaces: link to X (Twitter) Space + store participants for audience overlap (≥30% with another registered host)
ALTER TABLE public.spaces
  ADD COLUMN IF NOT EXISTS x_space_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_spaces_x_space_id ON public.spaces (x_space_id) WHERE x_space_id IS NOT NULL;

COMMENT ON COLUMN public.spaces.x_space_id IS 'X (Twitter) Space ID when synced from X; used for audience overlap with other registered users.';

-- Snapshot of participants (admins + speakers + listeners) for overlap calculation. Only both hosts registered → show "another planned".
CREATE TABLE IF NOT EXISTS public.space_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  x_user_id text NOT NULL,
  role text NOT NULL DEFAULT 'listener' CHECK (role IN ('admin','speaker','listener')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(space_id, x_user_id)
);

CREATE INDEX IF NOT EXISTS idx_space_participants_space ON public.space_participants (space_id);
CREATE INDEX IF NOT EXISTS idx_space_participants_x_user ON public.space_participants (x_user_id);

ALTER TABLE public.space_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "space_participants_select_via_space" ON public.space_participants;
CREATE POLICY "space_participants_select_via_space" ON public.space_participants FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_participants.space_id)
);

DROP POLICY IF EXISTS "space_participants_insert_service" ON public.space_participants;
-- Allow insert only when space host is current user (API uses service role for cron/sync)
CREATE POLICY "space_participants_insert_service" ON public.space_participants FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_participants.space_id AND s.host_profile_id = auth.uid())
);

DROP POLICY IF EXISTS "space_participants_delete_own_space" ON public.space_participants;
CREATE POLICY "space_participants_delete_own_space" ON public.space_participants FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.spaces s WHERE s.id = space_participants.space_id AND s.host_profile_id = auth.uid())
);
