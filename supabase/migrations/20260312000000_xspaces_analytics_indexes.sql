-- Performance: composite indexes for analytics and listing by project/space + status.
-- Safe and idempotent (IF NOT EXISTS).

CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_project_status
  ON public.space_sponsor_proposals (project_profile_id, status);

CREATE INDEX IF NOT EXISTS idx_space_sponsor_proposals_space_status
  ON public.space_sponsor_proposals (space_id, status);
