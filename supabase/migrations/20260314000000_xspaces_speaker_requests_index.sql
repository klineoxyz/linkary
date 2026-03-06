-- Performance: index for host-approved-speakers count (credibility + reputation).
-- Safe and idempotent (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_speaker_requests_space_status
  ON public.speaker_requests (space_id, status);
