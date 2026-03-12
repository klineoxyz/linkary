-- RPCs for invite wallet: state, issue, expire, replenish, admin grant.
-- Wallet codes: owner_user_id set, source_reason in ('base','activity_reward','manual','conversion_reward').
-- Active = status = 'available' AND (expires_at IS NULL OR expires_at > now()).

-- Reserve credits: sum(invite_credit_ledger.delta) per user. Capped at 10 for MVP in grant logic.

CREATE OR REPLACE FUNCTION public.get_invite_wallet_state(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_active_count int;
  v_reserve_credits int;
  v_codes jsonb;
  v_redeemed jsonb;
  v_successful int;
  v_frozen_until timestamptz;
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*)::int INTO v_active_count
  FROM public.invite_codes
  WHERE owner_user_id = v_user_id
    AND status = 'available'
    AND (expires_at IS NULL OR expires_at > now());

  SELECT COALESCE(SUM(delta), 0)::int INTO v_reserve_credits
  FROM public.invite_credit_ledger
  WHERE user_id = v_user_id;

  v_reserve_credits := LEAST(GREATEST(v_reserve_credits, 0), 10);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'code', code, 'status', status, 'expires_at', expires_at, 'source_reason', source_reason, 'created_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb) INTO v_codes
  FROM (
    SELECT id, code, status, expires_at, source_reason, created_at
    FROM public.invite_codes
    WHERE owner_user_id = v_user_id
    ORDER BY created_at DESC
    LIMIT 50
  ) sub;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ic.id, 'code', ic.code, 'redeemed_at', ic.redeemed_at, 'redeemed_by_user_id', ic.redeemed_by_user_id
  ) ORDER BY ic.redeemed_at DESC NULLS LAST), '[]'::jsonb) INTO v_redeemed
  FROM public.invite_codes ic
  WHERE ic.owner_user_id = v_user_id AND ic.status = 'redeemed'
  ORDER BY ic.redeemed_at DESC NULLS LAST
  LIMIT 50;

  SELECT COUNT(*)::int INTO v_successful
  FROM public.invite_attributions
  WHERE inviter_user_id = v_user_id AND attribution_status IN ('invitee_active', 'org_created', 'package_purchased');

  SELECT frozen_until INTO v_frozen_until
  FROM public.invite_policy_state
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'active_codes_count', v_active_count,
    'reserve_credits', v_reserve_credits,
    'max_active', 5,
    'max_reserve', 10,
    'codes', COALESCE(v_codes, '[]'::jsonb),
    'redeemed', COALESCE(v_redeemed, '[]'::jsonb),
    'successful_invites', v_successful,
    'frozen_until', v_frozen_until
  );
END;
$$;

COMMENT ON FUNCTION public.get_invite_wallet_state IS 'Returns wallet state for current user: active count, reserve credits, codes list, successful invites.';

GRANT EXECUTE ON FUNCTION public.get_invite_wallet_state TO authenticated;

-- Generate 10-char code (same charset as existing)
CREATE OR REPLACE FUNCTION public.gen_wallet_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Issue one wallet code (up to 5 active). Does not consume reserve; reserve is used by replenishment job.
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

  SELECT COUNT(*)::int INTO v_active_count
  FROM public.invite_codes
  WHERE owner_user_id = v_user_id
    AND status = 'available'
    AND (expires_at IS NULL OR expires_at > now());

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

COMMENT ON FUNCTION public.issue_wallet_invite_code IS 'Issue one wallet invite code. Fails if user has 5 active codes or is frozen.';

GRANT EXECUTE ON FUNCTION public.issue_wallet_invite_code TO authenticated;

-- Expire old wallet codes (call from cron)
CREATE OR REPLACE FUNCTION public.expire_invite_codes()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE public.invite_codes
  SET status = 'expired'
  WHERE status = 'available' AND expires_at IS NOT NULL AND expires_at < now();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.expire_invite_codes IS 'Set status to expired for available codes past expires_at. Call from cron.';

GRANT EXECUTE ON FUNCTION public.expire_invite_codes TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_invite_codes TO authenticated;

-- Replenish: create one code for a user who has reserve and active < 5 (healthy-account checks minimal for MVP)
CREATE OR REPLACE FUNCTION public.replenish_invite_from_reserve(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserve int;
  v_active int;
  v_code text;
  v_id uuid;
  v_frozen timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT frozen_until INTO v_frozen FROM public.invite_policy_state WHERE user_id = p_user_id;
  IF v_frozen IS NOT NULL AND v_frozen > now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'frozen');
  END IF;

  SELECT COALESCE(SUM(delta), 0)::int INTO v_reserve FROM public.invite_credit_ledger WHERE user_id = p_user_id;
  IF v_reserve <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_reserve');
  END IF;

  SELECT COUNT(*)::int INTO v_active
  FROM public.invite_codes
  WHERE owner_user_id = p_user_id AND status = 'available' AND (expires_at IS NULL OR expires_at > now());
  IF v_active >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_full');
  END IF;

  LOOP
    v_code := public.gen_wallet_invite_code();
    IF NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE upper(btrim(code)) = upper(v_code))
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(btrim(COALESCE(personal_invite_code, ''))) = upper(v_code)) THEN
      EXIT;
    END IF;
  END LOOP;

  INSERT INTO public.invite_credit_ledger (user_id, delta, reason, reference_type)
  VALUES (p_user_id, -1, 'replenish_issued', 'invite_code');

  INSERT INTO public.invite_codes (code, owner_user_id, issued_by_type, issued_by_id, issued_by_profile_id, status, expires_at, source_reason)
  VALUES (v_code, p_user_id, 'profile', p_user_id, p_user_id, 'available', now() + interval '30 days', 'activity_reward')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'code', v_code);
END;
$$;

COMMENT ON FUNCTION public.replenish_invite_from_reserve IS 'Create one code from reserve for user. Called by cron or after reward.';

GRANT EXECUTE ON FUNCTION public.replenish_invite_from_reserve TO service_role;

-- Admin: grant reserve credit (capped at 10 total per user)
CREATE OR REPLACE FUNCTION public.admin_grant_invite_reserve_credit(p_target_user_id uuid, p_delta int, p_reason text DEFAULT 'manual')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_admin_twitter text := 'muazxinthi';
  v_is_admin boolean;
  v_current int;
  v_after int;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT (LOWER(TRIM(BOTH '@' FROM COALESCE(twitter_username, ''))) = v_admin_twitter)
  INTO v_is_admin FROM public.profiles WHERE id = v_caller_id LIMIT 1;
  IF NOT COALESCE(v_is_admin, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF p_target_user_id IS NULL OR p_delta IS NULL OR p_delta <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT COALESCE(SUM(delta), 0)::int INTO v_current FROM public.invite_credit_ledger WHERE user_id = p_target_user_id;
  v_after := LEAST(v_current + p_delta, 10);
  IF v_after <= v_current THEN
    RETURN jsonb_build_object('ok', false, 'error', 'reserve_cap_reached');
  END IF;

  INSERT INTO public.invite_credit_ledger (user_id, delta, reason, reference_type, reference_id)
  VALUES (p_target_user_id, v_after - v_current, p_reason, 'admin', v_caller_id);

  RETURN jsonb_build_object('ok', true, 'reserve_after', v_after);
END;
$$;

COMMENT ON FUNCTION public.admin_grant_invite_reserve_credit IS 'Admin only. Grant reserve invite credit; total reserve capped at 10.';

GRANT EXECUTE ON FUNCTION public.admin_grant_invite_reserve_credit TO authenticated;
