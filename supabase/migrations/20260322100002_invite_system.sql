-- MVP: Invite-only platform access. Batches, codes, redemptions, inviter lineage.

-- Capacity: allocated in batches to profile/org. Normal users cap 500 lifetime; admin (@muazxinthi) unlimited (app logic).

CREATE TABLE IF NOT EXISTS public.invite_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocated_to_type text NOT NULL CHECK (allocated_to_type IN ('profile', 'org')),
  allocated_to_id uuid NOT NULL,
  count int NOT NULL CHECK (count > 0),
  allocated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_batches_allocated ON public.invite_batches (allocated_to_type, allocated_to_id);

COMMENT ON TABLE public.invite_batches IS 'Admin allocates invite capacity to a profile or org. Issuer consumes from batches up to lifetime cap (500).';

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  batch_id uuid REFERENCES public.invite_batches(id) ON DELETE SET NULL,
  issued_by_type text NOT NULL CHECK (issued_by_type IN ('profile', 'org')),
  issued_by_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'redeemed', 'expired', 'revoked')),
  reserved_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes (code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_issuer ON public.invite_codes (issued_by_type, issued_by_id);
CREATE INDEX IF NOT EXISTS idx_invite_codes_status ON public.invite_codes (status);

COMMENT ON COLUMN public.invite_codes.issued_by_id IS 'profiles.id or orgs.id: who can issue this code (for lineage: inviter = profile when issued_by_type=profile).';

CREATE TABLE IF NOT EXISTS public.invite_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code_id uuid NOT NULL REFERENCES public.invite_codes(id) ON DELETE CASCADE,
  redeemer_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (invite_code_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_redemptions_redeemer ON public.invite_redemptions (redeemer_profile_id);
CREATE INDEX IF NOT EXISTS idx_invite_redemptions_code ON public.invite_redemptions (invite_code_id);

COMMENT ON TABLE public.invite_redemptions IS 'One row per redeemed code. Links invitee (redeemer) to code; inviter from invite_codes.issued_by_id when issued_by_type=profile.';

ALTER TABLE public.invite_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_redemptions ENABLE ROW LEVEL SECURITY;

-- profiles: durable inviter for lineage (who invited this user onto the platform).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS inviter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.inviter_id IS 'Set on first invite redemption. Inviter profile_id for lineage; never cleared.';

-- RLS: invite_batches — allocator (admin) inserts; allocated_to can select own.
CREATE POLICY invite_batches_select_own
  ON public.invite_batches FOR SELECT
  USING (
    (allocated_to_type = 'profile' AND allocated_to_id = auth.uid())
    OR (allocated_to_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members WHERE org_id = invite_batches.allocated_to_id AND user_id = auth.uid()
    ))
  );

-- Insert only via service_role or app logic (admin allocate). No policy for INSERT = only service_role by default; we add an RPC or API uses service client for allocation.
CREATE POLICY invite_batches_insert_admin
  ON public.invite_batches FOR INSERT
  WITH CHECK (allocated_by = auth.uid());

-- invite_codes: issuer can select/insert (issue) their own; anyone can select by code for redemption check (we'll use RPC for redeem that uses service or anon + code).
CREATE POLICY invite_codes_select_own
  ON public.invite_codes FOR SELECT
  USING (
    (issued_by_type = 'profile' AND issued_by_id = auth.uid())
    OR (issued_by_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members WHERE org_id = invite_codes.issued_by_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY invite_codes_insert_own
  ON public.invite_codes FOR INSERT
  WITH CHECK (
    (issued_by_type = 'profile' AND issued_by_id = auth.uid())
    OR (issued_by_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members WHERE org_id = invite_codes.issued_by_id AND user_id = auth.uid()
    ))
  );

CREATE POLICY invite_codes_update_own
  ON public.invite_codes FOR UPDATE
  USING (
    (issued_by_type = 'profile' AND issued_by_id = auth.uid())
    OR (issued_by_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members WHERE org_id = invite_codes.issued_by_id AND user_id = auth.uid()
    ))
  );

-- invite_redemptions: redeemer sees own; inviter (via code) sees. For redeem we need INSERT: only via RPC that validates code and sets profile.inviter_id.
-- Allow SELECT for redeemer and for inviter (issued_by_id when issued_by_type=profile).
CREATE POLICY invite_redemptions_select_redeemer
  ON public.invite_redemptions FOR SELECT
  USING (redeemer_profile_id = auth.uid());

CREATE POLICY invite_redemptions_select_inviter
  ON public.invite_redemptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.invite_codes ic
    WHERE ic.id = invite_redemptions.invite_code_id
    AND ic.issued_by_type = 'profile' AND ic.issued_by_id = auth.uid()
  ));

-- INSERT for redemptions: must be done in a context where we verify the code. Use RPC redeem_invite_code(code, redeemer_profile_id) with SECURITY DEFINER to insert and update code + profile.
-- So we do not grant INSERT to anon/authenticated on invite_redemptions; only the RPC (service/superuser) inserts.
-- Alternatively: allow INSERT with CHECK (redeemer_profile_id = auth.uid()) so that the redeemer can insert their own redemption row after we've validated the code in API. But then we must update invite_codes and profile in the same transaction from the API. Safer: RPC that does all three.
-- We add an RPC in a separate migration or here:
CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code text, p_redeemer_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id uuid;
  v_issuer_id uuid;
  v_issuer_type text;
  v_exists int;
BEGIN
  IF p_redeemer_profile_id IS NULL OR p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF p_redeemer_profile_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  SELECT id, issued_by_id, issued_by_type INTO v_code_id, v_issuer_id, v_issuer_type
  FROM public.invite_codes
  WHERE code = btrim(p_code) AND status = 'available'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_unavailable_code');
  END IF;
  SELECT 1 INTO v_exists FROM public.invite_redemptions WHERE redeemer_profile_id = p_redeemer_profile_id LIMIT 1;
  IF v_exists = 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;
  INSERT INTO public.invite_redemptions (invite_code_id, redeemer_profile_id)
  VALUES (v_code_id, p_redeemer_profile_id);
  UPDATE public.invite_codes SET status = 'redeemed' WHERE id = v_code_id;
  IF v_issuer_type = 'profile' AND v_issuer_id IS NOT NULL THEN
    UPDATE public.profiles SET inviter_id = v_issuer_id WHERE id = p_redeemer_profile_id AND inviter_id IS NULL;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.redeem_invite_code IS 'Redeem an invite code for the current user. Sets profile.inviter_id when issuer is profile. Call from API after auth.';

GRANT EXECUTE ON FUNCTION public.redeem_invite_code TO authenticated;
