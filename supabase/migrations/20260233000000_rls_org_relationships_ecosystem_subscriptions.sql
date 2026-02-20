-- =============================================================================
-- RLS for org_relationships, org_ecosystem_categories, subscriptions
-- Platform hardening: no table with org/private user data without RLS.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- org_relationships
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_relationships ENABLE ROW LEVEL SECURITY;

-- SELECT: public read (relationship graph is discoverable for ecosystem)
CREATE POLICY "org_relationships_select_public" ON public.org_relationships
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: only org owner/admin of parent_org (or child for symmetric control)
CREATE POLICY "org_relationships_insert_org_admin" ON public.org_relationships
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_relationships.parent_org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_relationships_update_org_admin" ON public.org_relationships
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_relationships.parent_org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_relationships_delete_org_admin" ON public.org_relationships
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_relationships.parent_org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- org_ecosystem_categories
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_ecosystem_categories ENABLE ROW LEVEL SECURITY;

-- SELECT: public read (categories are public metadata)
CREATE POLICY "org_ecosystem_categories_select_public" ON public.org_ecosystem_categories
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE: only org owner/admin
CREATE POLICY "org_ecosystem_categories_insert_org_admin" ON public.org_ecosystem_categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_ecosystem_categories.org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_ecosystem_categories_update_org_admin" ON public.org_ecosystem_categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_ecosystem_categories.org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "org_ecosystem_categories_delete_org_admin" ON public.org_ecosystem_categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_ecosystem_categories.org_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

-- -----------------------------------------------------------------------------
-- subscriptions (NOT publicly readable; owner-only)
-- -----------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- SELECT: only the owner (profile = auth.uid(), or org = member as owner/admin)
CREATE POLICY "subscriptions_select_owner" ON public.subscriptions
  FOR SELECT USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR
    (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = subscriptions.owner_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    ))
  );

-- INSERT: owner only (profile or org admin)
CREATE POLICY "subscriptions_insert_owner" ON public.subscriptions
  FOR INSERT WITH CHECK (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR
    (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = subscriptions.owner_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    ))
  );

-- UPDATE/DELETE: same as SELECT
CREATE POLICY "subscriptions_update_owner" ON public.subscriptions
  FOR UPDATE USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR
    (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = subscriptions.owner_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    ))
  );

CREATE POLICY "subscriptions_delete_owner" ON public.subscriptions
  FOR DELETE USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR
    (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = subscriptions.owner_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    ))
  );
