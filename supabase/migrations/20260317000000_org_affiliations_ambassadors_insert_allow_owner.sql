-- Allow org owner (orgs.owner_profile_id) to insert into org_affiliations and org_ambassadors.
-- RLS previously only allowed when caller is in org_members; org owners may exist only via owner_profile_id.

DROP POLICY IF EXISTS "org_affiliations_insert_org_admin" ON public.org_affiliations;
CREATE POLICY "org_affiliations_insert_org_admin" ON public.org_affiliations
  FOR INSERT WITH CHECK (
    (SELECT o.owner_profile_id FROM public.orgs o WHERE o.id = org_affiliations.org_id) = auth.uid()
    OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_affiliations.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "org_ambassadors_insert_org_admin" ON public.org_ambassadors;
CREATE POLICY "org_ambassadors_insert_org_admin" ON public.org_ambassadors
  FOR INSERT WITH CHECK (
    (SELECT o.owner_profile_id FROM public.orgs o WHERE o.id = org_ambassadors.org_id) = auth.uid()
    OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_ambassadors.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );
