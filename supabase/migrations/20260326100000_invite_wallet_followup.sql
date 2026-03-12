-- Invite wallet follow-up: reward idempotency, healthy-account replenishment, cron cycle.
-- 1) Ledger idempotency for repeatable rewards: unique per (user_id, reason, reference)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_credit_ledger_idempotent
  ON public.invite_credit_ledger (user_id, reason, COALESCE(reference_type, ''), COALESCE(reference_id::text, ''));

-- 2) Replace grant_invite_reserve_for_milestone: one-time vs repeatable with reference keys (drop old 2-arg overload first)
DROP FUNCTION IF EXISTS public.grant_invite_reserve_for_milestone(uuid, text);

CREATE OR REPLACE FUNCTION public.grant_invite_reserve_for_milestone(
  p_user_id uuid,
  p_reason text,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_current int;
  v_delta int;
  v_one_time_reasons text[] := ARRAY['profile_complete', 'verified_social', 'first_activity'];
  v_repeatable_reasons text[] := ARRAY['invitee_active', 'org_active', 'package_purchase'];
  v_ref_type text := COALESCE(TRIM(p_reference_type), '');
  v_ref_id text := COALESCE(p_reference_id::text, '');
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;
  IF p_reason = ANY(v_one_time_reasons) THEN
    IF p_reference_type IS NOT NULL OR p_reference_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'one_time_reason_no_reference');
    END IF;
    v_ref_type := '';
    v_ref_id := '';
  ELSIF p_reason = ANY(v_repeatable_reasons) THEN
    IF p_reference_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'repeatable_reason_requires_reference_id');
    END IF;
    v_ref_type := COALESCE(TRIM(p_reference_type), CASE p_reason
      WHEN 'invitee_active' THEN 'attribution'
      WHEN 'org_active' THEN 'org'
      WHEN 'package_purchase' THEN 'package_purchase'
      ELSE 'ref'
    END);
    v_ref_id := p_reference_id::text;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invite_credit_ledger
    WHERE user_id = v_user_id AND reason = p_reason
      AND COALESCE(reference_type, '') = v_ref_type AND COALESCE(reference_id::text, '') = v_ref_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_granted', true);
  END IF;

  SELECT COALESCE(SUM(delta), 0)::int INTO v_current FROM public.invite_credit_ledger WHERE user_id = v_user_id;
  v_delta := LEAST(1, 10 - v_current);
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'capped', true);
  END IF;

  INSERT INTO public.invite_credit_ledger (user_id, delta, reason, reference_type, reference_id)
  VALUES (v_user_id, v_delta, p_reason, NULLIF(v_ref_type, ''), CASE WHEN v_ref_id = '' THEN NULL ELSE p_reference_id END);

  RETURN jsonb_build_object('ok', true, 'granted', v_delta);
END;
$$;

COMMENT ON FUNCTION public.grant_invite_reserve_for_milestone(uuid, text, text, uuid) IS 'Grant +1 reserve. One-time (profile_complete, verified_social, first_activity): no reference. Repeatable (invitee_active, org_active, package_purchase): require reference_id; idempotent per (user, reason, reference).';

-- 3) Healthy-account check for replenishment (MVP)
CREATE OR REPLACE FUNCTION public.invite_healthy_for_replenishment(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frozen timestamptz;
  v_created_at timestamptz;
  v_updated_at timestamptz;
  v_display_name text;
  v_username text;
  v_account_age_days int := 7;
  v_recent_activity_days int := 90;
BEGIN
  IF p_user_id IS NULL THEN RETURN false; END IF;

  SELECT frozen_until INTO v_frozen FROM public.invite_policy_state WHERE user_id = p_user_id;
  IF v_frozen IS NOT NULL AND v_frozen > now() THEN RETURN false; END IF;

  SELECT created_at, updated_at, display_name, username
  INTO v_created_at, v_updated_at, v_display_name, v_username
  FROM public.profiles WHERE id = p_user_id LIMIT 1;
  IF v_created_at IS NULL THEN RETURN false; END IF;

  IF v_created_at > (now() - (v_account_age_days || ' days')::interval) THEN RETURN false; END IF;

  IF (COALESCE(TRIM(v_display_name), '') = '' AND COALESCE(TRIM(v_username), '') = '') THEN RETURN false; END IF;

  IF v_updated_at IS NOT NULL AND v_updated_at < (now() - (v_recent_activity_days || ' days')::interval) THEN RETURN false; END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.invite_healthy_for_replenishment IS 'MVP healthy-account check: not frozen, account age >= 7 days, profile has display_name or username, profile updated in last 90 days.';

-- 4) Replenish only when healthy
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

  IF NOT public.invite_healthy_for_replenishment(p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_healthy');
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

-- 5) Cron: expire codes then replenish eligible users (batch)
CREATE OR REPLACE FUNCTION public.run_invite_replenishment_cycle(p_max_users int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired int;
  v_replenished int := 0;
  v_user_id uuid;
  v_ok boolean;
BEGIN
  v_expired := public.expire_invite_codes();

  FOR v_user_id IN
    SELECT led.user_id
    FROM (SELECT user_id FROM public.invite_credit_ledger GROUP BY user_id HAVING SUM(delta) > 0) led
    WHERE public.invite_healthy_for_replenishment(led.user_id)
      AND (SELECT COUNT(*)::int FROM public.invite_codes
           WHERE owner_user_id = led.user_id AND status = 'available'
             AND (expires_at IS NULL OR expires_at > now())) < 5
    LIMIT p_max_users
  LOOP
    SELECT (public.replenish_invite_from_reserve(v_user_id)->>'ok')::boolean INTO v_ok;
    IF v_ok THEN v_replenished := v_replenished + 1; END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'expired_codes', v_expired, 'replenished_users', v_replenished);
END;
$$;

COMMENT ON FUNCTION public.run_invite_replenishment_cycle IS 'Cron: expire stale codes, then replenish up to p_max_users eligible users (healthy, reserve > 0, active < 5).';

GRANT EXECUTE ON FUNCTION public.invite_healthy_for_replenishment TO service_role;
GRANT EXECUTE ON FUNCTION public.run_invite_replenishment_cycle TO service_role;
