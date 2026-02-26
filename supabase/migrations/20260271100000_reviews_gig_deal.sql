-- Allow reviews to reference gig_deals for verified profile-to-profile reviews.
-- When gig_deal_id is set, deal_id can be null. Trigger validates either path.

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS gig_deal_id uuid REFERENCES public.gig_deals(id) ON DELETE SET NULL;

ALTER TABLE public.reviews
  ALTER COLUMN deal_id DROP NOT NULL;

COMMENT ON COLUMN public.reviews.gig_deal_id IS 'Set for verified profile-to-profile reviews from gig deals; deal_id used for org deals.';

-- One review per gig_deal per reviewer (profile)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_gig_deal_reviewer
  ON public.reviews (gig_deal_id, reviewer_profile_id)
  WHERE gig_deal_id IS NOT NULL AND reviewer_profile_id IS NOT NULL;

-- Trigger: support both org deals (deal_id) and gig deals (gig_deal_id)
CREATE OR REPLACE FUNCTION public.reviews_check_deal_and_parties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  g record;
  reviewer_is_profile boolean;
  reviewer_is_org boolean;
  reviewee_is_profile boolean;
  reviewee_is_org boolean;
  reviewer_match boolean;
  reviewee_match boolean;
  self_review boolean;
BEGIN
  -- Gig deal path: profile-to-profile, verified by gig_deals
  IF NEW.gig_deal_id IS NOT NULL THEN
    SELECT id, owner_profile_id, participant_profile_id, status INTO g
    FROM public.gig_deals
    WHERE id = NEW.gig_deal_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Gig deal not found';
    END IF;
    IF g.status NOT IN ('active', 'completed') THEN
      RAISE EXCEPTION 'Verified review requires an active or completed deal. Deal status is %.', g.status;
    END IF;
    -- Reviewer and reviewee must be profile types and be the two parties (order doesn't matter)
    IF NEW.reviewer_type <> 'profile' OR NEW.reviewee_type <> 'profile' OR NEW.reviewer_profile_id IS NULL OR NEW.reviewee_profile_id IS NULL THEN
      RAISE EXCEPTION 'Gig deal reviews must be profile-to-profile';
    END IF;
    reviewer_match := (NEW.reviewer_profile_id = g.owner_profile_id AND NEW.reviewee_profile_id = g.participant_profile_id)
      OR (NEW.reviewer_profile_id = g.participant_profile_id AND NEW.reviewee_profile_id = g.owner_profile_id);
    IF NOT reviewer_match THEN
      RAISE EXCEPTION 'Reviewer and reviewee must be the two parties of the gig deal';
    END IF;
    IF NEW.reviewer_profile_id = NEW.reviewee_profile_id THEN
      RAISE EXCEPTION 'Self-review is not allowed';
    END IF;
    NEW.verified_deal := true;
    RETURN NEW;
  END IF;

  -- Org deal path: existing logic
  IF NEW.deal_id IS NULL THEN
    RAISE EXCEPTION 'Either deal_id or gig_deal_id is required';
  END IF;

  SELECT status, profile_id, org_id INTO d
  FROM public.deals
  WHERE id = NEW.deal_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF d.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Reviews only allowed for completed deals. Deal status is %.', COALESCE(d.status, 'null');
  END IF;

  reviewer_is_profile := (NEW.reviewer_type = 'profile' AND NEW.reviewer_profile_id IS NOT NULL);
  reviewer_is_org := (NEW.reviewer_type = 'org' AND NEW.reviewer_org_id IS NOT NULL);
  reviewee_is_profile := (NEW.reviewee_type = 'profile' AND NEW.reviewee_profile_id IS NOT NULL);
  reviewee_is_org := (NEW.reviewee_type = 'org' AND NEW.reviewee_org_id IS NOT NULL);

  reviewer_match :=
    (reviewer_is_profile AND NEW.reviewer_profile_id = d.profile_id)
    OR (reviewer_is_org AND NEW.reviewer_org_id = d.org_id);

  reviewee_match :=
    (reviewee_is_profile AND NEW.reviewee_profile_id = d.profile_id)
    OR (reviewee_is_org AND NEW.reviewee_org_id = d.org_id);

  IF NOT reviewer_match THEN
    RAISE EXCEPTION 'Reviewer must be a party to the deal (profile or org)';
  END IF;

  IF NOT (
    (reviewer_is_profile AND reviewee_is_org AND NEW.reviewee_org_id = d.org_id)
    OR (reviewer_is_org AND reviewee_is_profile AND NEW.reviewee_profile_id = d.profile_id)
  ) THEN
    RAISE EXCEPTION 'Reviewee must be the other party in the deal';
  END IF;

  self_review :=
    (reviewer_is_profile AND reviewee_is_profile AND NEW.reviewer_profile_id = NEW.reviewee_profile_id)
    OR (reviewer_is_org AND reviewee_is_org AND NEW.reviewer_org_id = NEW.reviewee_org_id);

  IF self_review THEN
    RAISE EXCEPTION 'Self-review is not allowed';
  END IF;

  NEW.verified_deal := true;
  RETURN NEW;
END;
$$;
