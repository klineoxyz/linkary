-- 1) Fix: "ic.redeemed_at must appear in GROUP BY" in get_invite_wallet_state.
--    Build v_redeemed from a subquery so the aggregate ORDER BY references subquery columns only.
-- 2) Superadmin (@muazxinthi): always ensure 5 available invite codes (replenish shortfall).

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

  SELECT COALESCE(jsonb_agg(obj ORDER BY rd_at DESC NULLS LAST), '[]'::jsonb) INTO v_redeemed
  FROM (
    SELECT
      jsonb_build_object('id', id, 'code', code, 'redeemed_at', redeemed_at, 'redeemed_by_user_id', redeemed_by_user_id) AS obj,
      redeemed_at AS rd_at
    FROM public.invite_codes
    WHERE owner_user_id = v_user_id AND status = 'redeemed'
    ORDER BY redeemed_at DESC NULLS LAST
    LIMIT 50
  ) sub;

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

-- Ensure superadmin (@muazxinthi) always has 5 available codes: replenish shortfall in ensure_initial_invite_codes.
CREATE OR REPLACE FUNCTION public.ensure_initial_invite_codes(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_count int;
  v_to_create int;
  v_code text;
  v_i int;
  v_is_superadmin boolean := false;
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN;
  END IF;

  SELECT (LOWER(TRIM(BOTH '@' FROM COALESCE(twitter_username, ''))) = 'muazxinthi')
  INTO v_is_superadmin FROM public.profiles WHERE id = v_user_id LIMIT 1;

  IF v_is_superadmin THEN
    -- Superadmin: always ensure 5 available codes (replenish shortfall)
    SELECT COUNT(*)::int INTO v_count
    FROM public.invite_codes
    WHERE owner_user_id = v_user_id
      AND status = 'available'
      AND (expires_at IS NULL OR expires_at > now());

    v_to_create := GREATEST(0, 5 - v_count);
  ELSE
    -- Normal user: grant 5 one-time codes only once (no replenishment)
    SELECT COUNT(*)::int INTO v_count
    FROM public.invite_codes
    WHERE owner_user_id = v_user_id AND source_reason = 'initial';

    IF v_count > 0 THEN
      RETURN;
    END IF;
    v_to_create := 5;
  END IF;

  IF v_to_create <= 0 THEN
    RETURN;
  END IF;

  FOR v_i IN 1 .. v_to_create LOOP
    LOOP
      v_code := public.gen_wallet_invite_code();
      IF NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE upper(btrim(code)) = upper(v_code))
         AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(btrim(COALESCE(personal_invite_code, ''))) = upper(v_code)) THEN
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.invite_codes (
      code, owner_user_id, issued_by_type, issued_by_id, issued_by_profile_id, status, expires_at, source_reason
    )
    VALUES (
      v_code, v_user_id, 'profile', v_user_id, v_user_id, 'available', NULL, CASE WHEN v_is_superadmin THEN 'admin' ELSE 'initial' END
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_initial_invite_codes IS 'Ensures current user has 5 one-time invite codes. Normal users: once (source_reason=initial). Superadmin (@muazxinthi): always replenish to 5 (source_reason=admin).';
