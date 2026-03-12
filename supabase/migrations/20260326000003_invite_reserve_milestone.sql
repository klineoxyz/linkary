-- Grant reserve invite credit for one-time milestones (profile_complete, verified_social, first_activity, etc.).
-- Call from app when milestone is reached. Each reason granted at most once per user. Reserve capped at 10.

CREATE OR REPLACE FUNCTION public.grant_invite_reserve_for_milestone(p_user_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_current int;
  v_already int;
  v_delta int;
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;
  IF p_reason NOT IN ('profile_complete', 'verified_social', 'first_activity', 'invitee_active', 'org_active', 'package_purchase') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;

  SELECT COUNT(*)::int INTO v_already
  FROM public.invite_credit_ledger
  WHERE user_id = v_user_id AND reason = p_reason;

  IF v_already > 0 THEN
    RETURN jsonb_build_object('ok', true, 'already_granted', true);
  END IF;

  SELECT COALESCE(SUM(delta), 0)::int INTO v_current FROM public.invite_credit_ledger WHERE user_id = v_user_id;
  v_delta := LEAST(1, 10 - v_current);
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'capped', true);
  END IF;

  INSERT INTO public.invite_credit_ledger (user_id, delta, reason, reference_type)
  VALUES (v_user_id, v_delta, p_reason, 'milestone');

  RETURN jsonb_build_object('ok', true, 'granted', v_delta);
END;
$$;

COMMENT ON FUNCTION public.grant_invite_reserve_for_milestone IS 'Grant +1 reserve credit for a one-time milestone. Call when user completes profile, verifies social, etc. Capped at 10 total reserve.';

GRANT EXECUTE ON FUNCTION public.grant_invite_reserve_for_milestone TO authenticated;
