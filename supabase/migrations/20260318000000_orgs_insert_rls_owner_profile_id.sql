-- =============================================================================
-- Orgs INSERT RLS hardening (security audit recommendation).
-- Prevent direct client inserts from assigning owner_profile_id to another user.
-- create_org_and_membership RPC is SECURITY DEFINER and bypasses RLS, so normal
-- app org creation is unchanged.
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS "orgs_insert_authed" ON public.orgs;

CREATE POLICY "orgs_insert_owner_self"
  ON public.orgs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_profile_id = auth.uid()
  );

COMMENT ON POLICY "orgs_insert_owner_self" ON public.orgs IS
  'Only allow insert when owner_profile_id equals current user. Prevents assigning org ownership to another user via direct client insert. App creates orgs via create_org_and_membership RPC (SECURITY DEFINER), which bypasses RLS.';

COMMIT;
