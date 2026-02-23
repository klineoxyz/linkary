-- =============================================================================
-- Connections (individual <-> individual) and org_follows (individual -> org).
-- Connection request/accept uses attestation checkboxes in v1; schema allows
-- future swap to real follow verification without migration.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) connections (individual to individual only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  requester_follow_attested boolean NOT NULL DEFAULT false,
  recipient_followback_attested boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connections_no_self CHECK (requester_profile_id <> recipient_profile_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connections_pair
  ON public.connections (requester_profile_id, recipient_profile_id);

CREATE INDEX IF NOT EXISTS idx_connections_requester ON public.connections (requester_profile_id);
CREATE INDEX IF NOT EXISTS idx_connections_recipient ON public.connections (recipient_profile_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON public.connections (status);

COMMENT ON TABLE public.connections IS 'Connection requests between individuals. v1: follow gating via attestation checkboxes; requester_follow_attested and recipient_followback_attested.';

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- SELECT: requester or recipient can read rows involving them
DROP POLICY IF EXISTS "connections_select_party" ON public.connections;
CREATE POLICY "connections_select_party" ON public.connections
  FOR SELECT USING (
    requester_profile_id = auth.uid() OR recipient_profile_id = auth.uid()
  );

-- INSERT: only requester = current user; no orgs (enforced in API by account_type)
DROP POLICY IF EXISTS "connections_insert_requester" ON public.connections;
CREATE POLICY "connections_insert_requester" ON public.connections
  FOR INSERT WITH CHECK (requester_profile_id = auth.uid());

-- UPDATE: requester can cancel (set declined) and set requester_follow_attested while pending; recipient can accept/decline and set recipient_followback_attested
DROP POLICY IF EXISTS "connections_update_requester" ON public.connections;
CREATE POLICY "connections_update_requester" ON public.connections
  FOR UPDATE USING (requester_profile_id = auth.uid());

DROP POLICY IF EXISTS "connections_update_recipient" ON public.connections;
CREATE POLICY "connections_update_recipient" ON public.connections
  FOR UPDATE USING (recipient_profile_id = auth.uid());

-- DELETE: not used; use status=declined instead. No DELETE policy so default deny.

-- -----------------------------------------------------------------------------
-- 2) org_follows (individual follows org)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_follows_unique UNIQUE (follower_profile_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_org_follows_follower ON public.org_follows (follower_profile_id);
CREATE INDEX IF NOT EXISTS idx_org_follows_org ON public.org_follows (org_id);

COMMENT ON TABLE public.org_follows IS 'Individual profiles following orgs; in-app follow only, not mutual connect.';

ALTER TABLE public.org_follows ENABLE ROW LEVEL SECURITY;

-- SELECT: follower can read own; org admins can read for their org (for counts)
DROP POLICY IF EXISTS "org_follows_select" ON public.org_follows;
CREATE POLICY "org_follows_select" ON public.org_follows
  FOR SELECT USING (
    follower_profile_id = auth.uid()
    OR public.is_org_admin(org_id, auth.uid())
  );

-- INSERT: only follower = current user
DROP POLICY IF EXISTS "org_follows_insert_follower" ON public.org_follows;
CREATE POLICY "org_follows_insert_follower" ON public.org_follows
  FOR INSERT WITH CHECK (follower_profile_id = auth.uid());

-- DELETE: only follower
DROP POLICY IF EXISTS "org_follows_delete_follower" ON public.org_follows;
CREATE POLICY "org_follows_delete_follower" ON public.org_follows
  FOR DELETE USING (follower_profile_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) connections updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_connections_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS connections_updated_at ON public.connections;
CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_connections_updated_at();

COMMIT;
