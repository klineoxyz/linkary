-- =============================================================================
-- Reviews end-to-end: deal_id required, one review per deal per reviewer,
-- trigger enforces deal completed + reviewer/reviewee are parties + no self-review.
-- Deals: delivered_at, accepted_at, completed_at for bilateral completion.
-- =============================================================================

-- 1) Deals: add completion timestamps
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

COMMENT ON COLUMN public.deals.delivered_at IS 'Creator marked work delivered';
COMMENT ON COLUMN public.deals.accepted_at IS 'Org marked work accepted';
COMMENT ON COLUMN public.deals.completed_at IS 'Set when both delivered and accepted; deal is then completed';

-- 1b) Trigger: when both delivered_at and accepted_at set, set completed_at and status = completed
CREATE OR REPLACE FUNCTION public.deals_set_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.delivered_at IS NOT NULL AND NEW.accepted_at IS NOT NULL AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
    NEW.status := 'completed';
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_set_completed ON public.deals;
CREATE TRIGGER trg_deals_set_completed
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.deals_set_completed();

-- 2) Reviews: ensure all required columns exist (remote may have older schema)
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reviewer_type text,
  ADD COLUMN IF NOT EXISTS reviewer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewer_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewee_type text,
  ADD COLUMN IF NOT EXISTS reviewee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewee_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL;

-- Remove any reviews that have no deal or invalid reviewer/reviewee (legacy rows)
DELETE FROM public.reviews WHERE deal_id IS NULL;
DELETE FROM public.reviews
  WHERE reviewer_type IS NULL
     OR (reviewer_type = 'profile' AND reviewer_profile_id IS NULL)
     OR (reviewer_type = 'org' AND reviewer_org_id IS NULL)
     OR reviewee_type IS NULL
     OR (reviewee_type = 'profile' AND reviewee_profile_id IS NULL)
     OR (reviewee_type = 'org' AND reviewee_org_id IS NULL);

ALTER TABLE public.reviews
  ALTER COLUMN deal_id SET NOT NULL;

-- 3) One review per deal per reviewer (unique)
-- Use COALESCE so (deal_id, reviewer_type, profile_id, org_id) is unique per reviewer
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_one_per_deal_reviewer
  ON public.reviews (
    deal_id,
    reviewer_type,
    COALESCE(reviewer_profile_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(reviewer_org_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- 4) Trigger: reject review insert unless deal is completed and reviewer/reviewee are parties and not self
CREATE OR REPLACE FUNCTION public.reviews_check_deal_and_parties()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  reviewer_is_profile boolean;
  reviewer_is_org boolean;
  reviewee_is_profile boolean;
  reviewee_is_org boolean;
  reviewer_match boolean;
  reviewee_match boolean;
  self_review boolean;
BEGIN
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

  -- Reviewee must be the other party: if reviewer is profile (creator), reviewee is org; if reviewer is org, reviewee is profile
  IF NOT (
    (reviewer_is_profile AND reviewee_is_org AND NEW.reviewee_org_id = d.org_id)
    OR (reviewer_is_org AND reviewee_is_profile AND NEW.reviewee_profile_id = d.profile_id)
  ) THEN
    RAISE EXCEPTION 'Reviewee must be the other party in the deal';
  END IF;

  -- Self-review: reviewer and reviewee are same entity
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

DROP TRIGGER IF EXISTS trg_reviews_check_deal_and_parties ON public.reviews;
CREATE TRIGGER trg_reviews_check_deal_and_parties
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_check_deal_and_parties();

-- 4b) Deals: allow profile (creator) to update own deal (for mark-delivered)
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deals_update_profile_party" ON public.deals
  FOR UPDATE USING (profile_id = auth.uid());

-- 5) RLS: ensure reviews has correct policies (drop and recreate for clarity)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
CREATE POLICY "reviews_select_public" ON public.reviews FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_reviewer" ON public.reviews;
CREATE POLICY "reviews_insert_reviewer" ON public.reviews
  FOR INSERT WITH CHECK (
    (reviewer_type = 'profile' AND reviewer_profile_id = auth.uid())
    OR (reviewer_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = reviews.reviewer_org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))
  );

-- No UPDATE/DELETE policies: reviews are immutable
