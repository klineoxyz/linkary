-- Creators (invitees) can read their own job invites for in-app visibility.
CREATE POLICY org_job_invites_select_invitee
  ON public.org_job_invites FOR SELECT
  USING (profile_id = auth.uid());
