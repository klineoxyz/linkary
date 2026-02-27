-- P11: Verified reviews after collab (status = done).
-- One review per side per collab_request.

CREATE TABLE public.collab_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collab_request_id uuid NOT NULL REFERENCES public.collab_requests(id) ON DELETE CASCADE,
  reviewer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text varchar(1000) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collab_reviews_reviewer_ne_target CHECK (reviewer_profile_id <> target_profile_id),
  CONSTRAINT collab_reviews_one_per_collab_reviewer UNIQUE (collab_request_id, reviewer_profile_id)
);

COMMENT ON TABLE public.collab_reviews IS 'Verified reviews left after a collab request is done; one review per reviewer per request.';

CREATE INDEX idx_collab_reviews_target_created ON public.collab_reviews (target_profile_id, created_at DESC);
CREATE INDEX idx_collab_reviews_collab_request ON public.collab_reviews (collab_request_id);

ALTER TABLE public.collab_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT: public can read if target profile is published (same as public_profile_view logic); or user is reviewer/target
CREATE POLICY "collab_reviews_select_public_or_participant"
  ON public.collab_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = collab_reviews.target_profile_id
        AND p.published = true
        AND p.username IS NOT NULL
        AND p.username <> ''
    )
    OR reviewer_profile_id = auth.uid()
    OR target_profile_id = auth.uid()
  );

-- INSERT: authenticated user must be requester or target of the collab_request, request must be done, and user is the reviewer
CREATE POLICY "collab_reviews_insert_done_participant"
  ON public.collab_reviews FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reviewer_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.collab_requests cr
      WHERE cr.id = collab_request_id
        AND cr.status = 'done'
        AND (cr.requester_profile_id = auth.uid() OR cr.target_profile_id = auth.uid())
    )
  );

-- No UPDATE/DELETE policies: reviews are immutable once created.
