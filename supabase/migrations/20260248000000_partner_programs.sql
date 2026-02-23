-- =============================================================================
-- Partner programs: Affiliates/Ambassadors as proper tables (profile- or org-owned).
-- RLS: public read when owner published; write only by owner (profile) or org admin.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1) Table partner_programs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  program_type text NOT NULL CHECK (program_type IN ('affiliate', 'ambassador')),
  name text NOT NULL,
  website_url text,
  logo_url text,
  description text,
  since_date date,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_programs_unique_name_per_owner
  ON public.partner_programs (owner_type, owner_id, lower(trim(name)), program_type);

CREATE INDEX IF NOT EXISTS idx_partner_programs_owner_type_owner_id_program_type_sort
  ON public.partner_programs (owner_type, owner_id, program_type, sort_order);

COMMENT ON TABLE public.partner_programs IS 'Affiliate and ambassador programs for profiles and orgs; shown on public 1-pager when published.';

-- -----------------------------------------------------------------------------
-- 2) RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.partner_programs ENABLE ROW LEVEL SECURITY;

-- SELECT: public when owner published, or owner (for editing when unpublished)
DROP POLICY IF EXISTS "partner_programs_select" ON public.partner_programs;
CREATE POLICY "partner_programs_select" ON public.partner_programs
  FOR SELECT USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND public.is_org_admin(owner_id, auth.uid()))
    OR (owner_type = 'profile' AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = partner_programs.owner_id AND p.published = true
    ))
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.orgs o WHERE o.id = partner_programs.owner_id AND o.published = true
    ))
  );

-- INSERT: only owner
DROP POLICY IF EXISTS "partner_programs_insert_owner" ON public.partner_programs;
CREATE POLICY "partner_programs_insert_owner" ON public.partner_programs
  FOR INSERT WITH CHECK (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND public.is_org_admin(owner_id, auth.uid()))
  );

-- UPDATE: only owner
DROP POLICY IF EXISTS "partner_programs_update_owner" ON public.partner_programs;
CREATE POLICY "partner_programs_update_owner" ON public.partner_programs
  FOR UPDATE USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND public.is_org_admin(owner_id, auth.uid()))
  );

-- DELETE: only owner
DROP POLICY IF EXISTS "partner_programs_delete_owner" ON public.partner_programs;
CREATE POLICY "partner_programs_delete_owner" ON public.partner_programs
  FOR DELETE USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND public.is_org_admin(owner_id, auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 3) updated_at trigger
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_partner_programs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_programs_updated_at ON public.partner_programs;
CREATE TRIGGER partner_programs_updated_at
  BEFORE UPDATE ON public.partner_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_partner_programs_updated_at();

COMMIT;
