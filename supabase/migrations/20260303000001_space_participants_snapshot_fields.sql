-- Participant snapshot metadata for freshness and consistency
ALTER TABLE public.space_participants
  ADD COLUMN IF NOT EXISTS snapshot_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'twitterapi.io';

COMMENT ON COLUMN public.space_participants.snapshot_at IS 'When this participant snapshot was captured; replaced on each sync.';
COMMENT ON COLUMN public.space_participants.source IS 'Source of the snapshot, e.g. twitterapi.io';
