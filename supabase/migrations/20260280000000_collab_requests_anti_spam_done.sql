-- P9: Anti-spam (one open request per pair + cooldown) and "done" status.

-- 1) Add 'done' to allowed status values (drop and recreate CHECK; name may vary by PG version)
ALTER TABLE public.collab_requests
  DROP CONSTRAINT IF EXISTS collab_requests_status_check;

ALTER TABLE public.collab_requests
  ADD CONSTRAINT collab_requests_status_check
  CHECK (status IN ('new', 'accepted', 'archived', 'done'));

-- 2) One open request per requester-target pair (status = 'new' only)
CREATE UNIQUE INDEX IF NOT EXISTS idx_collab_requests_one_open_per_pair
  ON public.collab_requests (requester_profile_id, target_profile_id)
  WHERE (status = 'new');

-- 3) Index for cooldown lookup: most recent request between a pair
CREATE INDEX IF NOT EXISTS idx_collab_requests_pair_created
  ON public.collab_requests (requester_profile_id, target_profile_id, created_at DESC);
