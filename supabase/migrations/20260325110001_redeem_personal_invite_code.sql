-- Redeem by personal_invite_code: when code is not in invite_codes, look up profile by personal_invite_code.
-- Cap: each profile can have at most 5 invitees (profiles with inviter_id = that profile).

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
  v_personal_inviter_id uuid;
  v_invite_count int;
  v_code_trim text;
BEGIN
  IF p_redeemer_profile_id IS NULL OR p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;
  IF p_redeemer_profile_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  v_code_trim := upper(btrim(p_code));

  -- 1) Try invite_codes (one-time codes)
  SELECT id, issued_by_id, issued_by_type, issued_by_profile_id
  INTO v_code_id, v_issuer_id, v_issuer_type, v_issued_by_profile_id
  FROM public.invite_codes
  WHERE upper(btrim(code)) = v_code_trim AND status = 'available'
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_code_id IS NOT NULL THEN
    SELECT 1 INTO v_exists FROM public.invite_redemptions WHERE redeemer_profile_id = p_redeemer_profile_id LIMIT 1;
    IF v_exists = 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
    END IF;
    v_inviter_id := COALESCE(v_issued_by_profile_id, CASE WHEN v_issuer_type = 'profile' AND v_issuer_id IS NOT NULL THEN v_issuer_id ELSE NULL END);
    INSERT INTO public.invite_redemptions (invite_code_id, redeemer_profile_id)
    VALUES (v_code_id, p_redeemer_profile_id);
    UPDATE public.invite_codes SET status = 'redeemed' WHERE id = v_code_id;
    IF v_inviter_id IS NOT NULL THEN
      UPDATE public.profiles SET inviter_id = v_inviter_id WHERE id = p_redeemer_profile_id AND inviter_id IS NULL;
    END IF;
    RETURN jsonb_build_object('ok', true);
  END IF;

  -- 2) Try personal_invite_code (reusable, cap 5 per profile)
  SELECT id INTO v_personal_inviter_id
  FROM public.profiles
  WHERE upper(btrim(personal_invite_code)) = v_code_trim
    AND id != p_redeemer_profile_id
  LIMIT 1;

  IF v_personal_inviter_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_or_unavailable_code');
  END IF;

  SELECT 1 INTO v_exists FROM public.invite_redemptions WHERE redeemer_profile_id = p_redeemer_profile_id LIMIT 1;
  IF v_exists = 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  SELECT COUNT(*)::int INTO v_invite_count
  FROM public.profiles
  WHERE inviter_id = v_personal_inviter_id;

  IF v_invite_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'inviter_limit_reached');
  END IF;

  UPDATE public.profiles
  SET inviter_id = v_personal_inviter_id
  WHERE id = p_redeemer_profile_id AND inviter_id IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.redeem_invite_code IS 'Redeem by one-time code (invite_codes) or by personal_invite_code (max 5 invitees per profile).';
