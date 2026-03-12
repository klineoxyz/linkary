-- Final policy: reward values (1/2/3) and first-touch package attribution.
-- No change to personal-code or batch-expiry rules (docs only).

-- 1) Reward values: invitee_active +1, org_active +2, package_purchase +3; one-time milestones +1 each. Reserve cap 10.
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
    v_delta := 1;
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
    v_delta := CASE p_reason
      WHEN 'invitee_active' THEN 1
      WHEN 'org_active' THEN 2
      WHEN 'package_purchase' THEN 3
      ELSE 1
    END;
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
  v_delta := LEAST(v_delta, GREATEST(0, 10 - v_current));
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'capped', true);
  END IF;

  INSERT INTO public.invite_credit_ledger (user_id, delta, reason, reference_type, reference_id)
  VALUES (v_user_id, v_delta, p_reason, NULLIF(v_ref_type, ''), CASE WHEN v_ref_id = '' THEN NULL ELSE p_reference_id END);

  RETURN jsonb_build_object('ok', true, 'granted', v_delta);
END;
$$;

COMMENT ON FUNCTION public.grant_invite_reserve_for_milestone(uuid, text, text, uuid) IS 'Reserve credits: profile_complete/verified_social/first_activity +1 each; invitee_active +1; org_active +2; package_purchase +3. Cap 10 total. Idempotent per (user, reason, reference).';

-- 2) Package attribution: first-touch only. Single winning inviter = earliest attribution (created_at) for this org in 90-day window.
CREATE OR REPLACE FUNCTION public.record_invite_package_attribution(
  p_org_id uuid,
  p_purchase_id uuid,
  p_package_type text DEFAULT NULL,
  p_amount_cents int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution_id uuid;
  v_inviter_id uuid;
  v_attribution_window_days int := 90;
BEGIN
  IF p_org_id IS NULL OR p_purchase_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  SELECT id, inviter_user_id INTO v_attribution_id, v_inviter_id
  FROM public.invite_attributions
  WHERE invitee_org_id = p_org_id
    AND created_at >= (now() - (v_attribution_window_days || ' days')::interval)
    AND attribution_status != 'package_purchased'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_attribution_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'attributions_updated', 0, 'reserve_grants', 0);
  END IF;

  UPDATE public.invite_attributions
  SET
    package_purchase_id = p_purchase_id,
    package_type = p_package_type,
    package_amount_cents = p_amount_cents,
    package_purchased_at = now(),
    attribution_status = 'package_purchased'
  WHERE id = v_attribution_id;

  PERFORM public.grant_invite_reserve_for_milestone(v_inviter_id, 'package_purchase', 'package_purchase', p_purchase_id);

  RETURN jsonb_build_object('ok', true, 'attributions_updated', 1, 'reserve_grants', 1);
END;
$$;

COMMENT ON FUNCTION public.record_invite_package_attribution(uuid, uuid, text, int) IS 'First-touch: single winning inviter = earliest attribution (created_at) for this org in 90-day window. Updates that row and grants package_purchase reserve (+3, cap 10).';
