-- Collab requests: one user requests to collaborate with another (individual profile).
-- Requester creates; target can read and update status.

CREATE TABLE public.collab_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  category text,
  budget_text text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','archived'))
);

CREATE INDEX idx_collab_requests_target_created ON public.collab_requests (target_profile_id, created_at DESC);
CREATE INDEX idx_collab_requests_requester_created ON public.collab_requests (requester_profile_id, created_at DESC);

ALTER TABLE public.collab_requests ENABLE ROW LEVEL SECURITY;

-- Insert: only as requester (requester_profile_id = auth.uid())
CREATE POLICY "collab_requests_insert_requester"
  ON public.collab_requests FOR INSERT
  WITH CHECK (requester_profile_id = auth.uid());

-- Select: requester or target
CREATE POLICY "collab_requests_select_requester_or_target"
  ON public.collab_requests FOR SELECT
  USING (
    requester_profile_id = auth.uid()
    OR target_profile_id = auth.uid()
  );

-- Update: only target (can change status)
CREATE POLICY "collab_requests_update_target"
  ON public.collab_requests FOR UPDATE
  USING (target_profile_id = auth.uid())
  WITH CHECK (target_profile_id = auth.uid());

-- No delete policy: only target could be allowed to "delete" (e.g. archive); we use status instead.
