-- Allow any authenticated user to SELECT creator_programs where status = 'open' (for marketplace discovery).
-- Org members continue to see all their org's programs via creator_programs_select_org.
CREATE POLICY creator_programs_select_open
  ON public.creator_programs FOR SELECT
  USING (status = 'open');
