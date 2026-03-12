-- Global invite scarcity: one cap (5 active codes) across wallet + batch + any user-owned codes.
-- Policy: A user has at most 5 active (available, unexpired) invite codes regardless of source.
-- Exception: Admin (twitter = muazxinthi) is exempt from the cap for batch issue only; wallet still caps at 5.

-- Count all active codes owned by or issued by this user (profile-scoped).
CREATE OR REPLACE FUNCTION public.get_user_active_invite_count(p_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*)::int INTO v_count
  FROM public.invite_codes
  WHERE status = 'available'
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      owner_user_id = p_user_id
      OR (issued_by_type = 'profile' AND issued_by_id = p_user_id)
    );
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.get_user_active_invite_count IS 'Global active invite count for user: wallet + batch + any profile-issued. Used for 5-code cap.';

GRANT EXECUTE ON FUNCTION public.get_user_active_invite_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_active_invite_count TO service_role;

-- issue_wallet_invite_code: use global count so wallet + batch share the same 5 slot cap
CREATE OR REPLACE FUNCTION public.issue_wallet_invite_code(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_active_count int;
  v_code text;
  v_id uuid;
  v_frozen timestamptz;
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT frozen_until INTO v_frozen FROM public.invite_policy_state WHERE user_id = v_user_id;
  IF v_frozen IS NOT NULL AND v_frozen > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invite_frozen');
  END IF;

  v_active_count := public.get_user_active_invite_count(v_user_id);
  IF v_active_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_active_codes');
  END IF;

  LOOP
    v_code := public.gen_wallet_invite_code();
    IF NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE upper(btrim(code)) = upper(v_code))
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(btrim(COALESCE(personal_invite_code, ''))) = upper(v_code)) THEN
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.invite_codes (code, owner_user_id, issued_by_type, issued_by_id, issued_by_profile_id, status, expires_at, source_reason)
  VALUES (v_code, v_user_id, 'profile', v_user_id, v_user_id, 'available', now() + interval '30 days', 'base')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code, 'expires_at', now() + interval '30 days');
END;
$$;

COMMENT ON FUNCTION public.issue_wallet_invite_code IS 'Issue one wallet invite code. Fails if user has 5 active codes (global cap) or is frozen.';
