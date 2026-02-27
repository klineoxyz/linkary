-- P4: Read tracking for collab requests (inbox "new" count = unread until seen).
-- Only target can update seen_at (existing update policy allows any column).

ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- Optional: index for inbox "new + unseen" count and listing
CREATE INDEX IF NOT EXISTS idx_collab_requests_target_status_seen_created
  ON public.collab_requests (target_profile_id, status, seen_at NULLS FIRST, created_at DESC);
