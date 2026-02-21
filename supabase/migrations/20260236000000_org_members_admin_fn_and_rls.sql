-- =============================================================================
-- Org members: is_org_admin helper (SECURITY DEFINER), RLS for teams, last-owner guardrail.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) SECURITY DEFINER helper: no recursion, safe for use in RLS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.orgs o WHERE o.id = p_org_id AND o.owner_profile_id = p_uid
  ) OR EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = p_org_id AND m.user_id = p_uid AND m.role IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_org_admin(uuid, uuid) IS 'True if user is org owner (owner_profile_id) or org_members owner/admin. SECURITY DEFINER so RLS can use it without recursion.';

-- -----------------------------------------------------------------------------
-- B) Ensure unique (org_id, user_id) - already exists in MVP, enforce if missing
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_members'::regclass AND conname = 'org_members_org_id_user_id_key'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'org_members' AND indexdef LIKE '%UNIQUE%' AND indexdef LIKE '%org_id%'
  ) THEN
    CREATE UNIQUE INDEX org_members_org_id_user_id_key ON public.org_members (org_id, user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- C) Replace org_members RLS policies (teams: admins can list/add/update/remove)
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select_own" ON public.org_members;
DROP POLICY IF EXISTS "org_members_insert_by_owner" ON public.org_members;
DROP POLICY IF EXISTS "org_members_update_own_or_owner" ON public.org_members;
DROP POLICY IF EXISTS "org_members_delete_own_or_owner" ON public.org_members;

CREATE POLICY "org_members_select_own_or_admin" ON public.org_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.is_org_admin(org_id, auth.uid())
  );

CREATE POLICY "org_members_insert_by_admin" ON public.org_members
  FOR INSERT WITH CHECK (
    public.is_org_admin(org_id, auth.uid())
    AND role IN ('owner', 'admin', 'member')
    AND user_id IS NOT NULL
  );

CREATE POLICY "org_members_update_admin_or_self" ON public.org_members
  FOR UPDATE USING (
    public.is_org_admin(org_id, auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "org_members_delete_admin_or_self" ON public.org_members
  FOR DELETE USING (
    public.is_org_admin(org_id, auth.uid())
    OR user_id = auth.uid()
  );

-- -----------------------------------------------------------------------------
-- D) Last-owner guardrail: prevent removing or downgrading last owner
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.org_members_ensure_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner' THEN
      SELECT count(*)::integer INTO owner_count
      FROM public.org_members
      WHERE org_id = OLD.org_id AND role = 'owner' AND id <> OLD.id;
      IF owner_count < 1 THEN
        RAISE EXCEPTION 'Organization must have at least one owner';
      END IF;
    END IF;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role = 'owner' AND (NEW.role IS NULL OR NEW.role <> 'owner') THEN
      SELECT count(*)::integer INTO owner_count
      FROM public.org_members
      WHERE org_id = OLD.org_id AND role = 'owner' AND id <> OLD.id;
      IF owner_count < 1 THEN
        RAISE EXCEPTION 'Organization must have at least one owner';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_members_ensure_last_owner ON public.org_members;
CREATE TRIGGER trg_org_members_ensure_last_owner
  BEFORE UPDATE OR DELETE ON public.org_members
  FOR EACH ROW
  EXECUTE FUNCTION public.org_members_ensure_last_owner();

-- -----------------------------------------------------------------------------
-- E) Orgs UPDATE policy: use is_org_admin (consistent, no org_members self-join in policy)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "orgs_update_owner_admin" ON public.orgs;
CREATE POLICY "orgs_update_owner_admin" ON public.orgs
  FOR UPDATE USING (public.is_org_admin(id, auth.uid()));

COMMIT;
