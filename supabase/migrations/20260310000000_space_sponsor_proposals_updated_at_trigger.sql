-- Ensure space_sponsor_proposals.updated_at is set on every UPDATE (consistent with connections pattern).
CREATE OR REPLACE FUNCTION public.set_space_sponsor_proposals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS space_sponsor_proposals_updated_at ON public.space_sponsor_proposals;
CREATE TRIGGER space_sponsor_proposals_updated_at
  BEFORE UPDATE ON public.space_sponsor_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_space_sponsor_proposals_updated_at();
