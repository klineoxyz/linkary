-- Creator-side response on job invites (minimal, non-CRM). Applied/deal remain derived from applications/deals.

ALTER TABLE public.org_job_invites
  ADD COLUMN IF NOT EXISTS creator_response text NOT NULL DEFAULT 'pending'
    CHECK (creator_response IN ('pending', 'interested', 'declined', 'dismissed'));

ALTER TABLE public.org_job_invites
  ADD COLUMN IF NOT EXISTS creator_responded_at timestamptz;

ALTER TABLE public.org_job_invites
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

COMMENT ON COLUMN public.org_job_invites.creator_response IS 'Invitee-only: pending | interested | declined | dismissed. Does not replace applications/deals.';
COMMENT ON COLUMN public.org_job_invites.viewed_at IS 'First time invitee opened invite in app (optional).';

CREATE OR REPLACE FUNCTION public.org_job_invites_invitee_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  -- Invitee updates only: RLS limits to profile_id = auth.uid()
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.profile_id THEN
    IF NEW.id IS DISTINCT FROM OLD.id
       OR NEW.org_id IS DISTINCT FROM OLD.org_id
       OR NEW.job_id IS DISTINCT FROM OLD.job_id
       OR NEW.profile_id IS DISTINCT FROM OLD.profile_id
       OR NEW.kol_list_id IS DISTINCT FROM OLD.kol_list_id
       OR NEW.invited_at IS DISTINCT FROM OLD.invited_at THEN
      RAISE EXCEPTION 'Invitee may only update creator_response, viewed_at, creator_responded_at';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_job_invites_invitee_guard ON public.org_job_invites;
CREATE TRIGGER trg_org_job_invites_invitee_guard
  BEFORE UPDATE ON public.org_job_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.org_job_invites_invitee_guard();

CREATE POLICY org_job_invites_update_invitee_response
  ON public.org_job_invites FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
