-- Invite lineage: persist the human inviter for chain-reaction graph.
-- When an org issues a code, issued_by_id = org_id; we still need the profile who actually issued it for profiles.inviter_id.
-- issued_by_profile_id = the profile (human) who issued this code; used for lineage. profiles.inviter_id is set from this on redemption.

ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS issued_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invite_codes_issued_by_profile ON public.invite_codes (issued_by_profile_id) WHERE issued_by_profile_id IS NOT NULL;

COMMENT ON COLUMN public.invite_codes.issued_by_profile_id IS 'Profile (human) who issued this code. Used for inviter lineage; set even when issued_by_type=org. On redemption, profiles.inviter_id = issued_by_profile_id when present, else issued_by_id when issued_by_type=profile.';

-- Update redeem function: set inviter_id from issued_by_profile_id when present, else from issued_by_id when issuer is profile.
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
  v_issued_by_profile_id uuid;
  v_inviter_id uuid;
  v_exists int;
BEGIN
  IF p_redeemer_profile_id IS NULL OR p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF p_redeemer_profile_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  SELECT id, issued_by_id, issued_by_type, issued_by_profile_id
  INTO v_code_id, v_issuer_id, v_issuer_type, v_issued_by_profile_id
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
  -- Human inviter for lineage: prefer issued_by_profile_id (e.g. org-issued code by a person), else issuer when profile.
  v_inviter_id := COALESCE(v_issued_by_profile_id, CASE WHEN v_issuer_type = 'profile' AND v_issuer_id IS NOT NULL THEN v_issuer_id ELSE NULL END);
  INSERT INTO public.invite_redemptions (invite_code_id, redeemer_profile_id)
  VALUES (v_code_id, p_redeemer_profile_id);
  UPDATE public.invite_codes SET status = 'redeemed' WHERE id = v_code_id;
  IF v_inviter_id IS NOT NULL THEN
    UPDATE public.profiles SET inviter_id = v_inviter_id WHERE id = p_redeemer_profile_id AND inviter_id IS NULL;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.redeem_invite_code IS 'Redeem invite code. Sets profile.inviter_id from invite_codes.issued_by_profile_id when present, else from issued_by_id when issued_by_type=profile.';
