-- Invite event wiring: internal grant-for-user (for inviter rewards) and record_invitee_active / record_invitee_org_created.
-- These allow the app to grant reserve credits to the inviter when invitee completes activation or creates an org.
-- Does not change existing grant_invite_reserve_for_milestone (self-grant only).

-- 1) Internal: grant reserve for a given user (no auth.uid() check). Only to be called from SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.grant_invite_reserve_for_milestone_for_user(
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
  v_current int;
  v_delta int;
  v_one_time_reasons text[] := ARRAY['profile_complete', 'verified_social', 'first_activity'];
  v_repeatable_reasons text[] := ARRAY['invitee_active', 'org_active', 'package_purchase'];
  v_ref_type text := COALESCE(TRIM(p_reference_type), '');
  v_ref_id text := COALESCE(p_reference_id::text, '');
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_user');
  END IF;
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_reason');
  END IF;
  IF p_reason = ANY(v_one_time_reasons) THEN
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
    WHERE user_id = p_user_id AND reason = p_reason
      AND COALESCE(reference_type, '') = v_ref_type AND COALESCE(reference_id::text, '') = v_ref_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'already_granted', true);
  END IF;

  SELECT COALESCE(SUM(delta), 0)::int INTO v_current FROM public.invite_credit_ledger WHERE user_id = p_user_id;
  v_delta := LEAST(v_delta, GREATEST(0, 10 - v_current));
  IF v_delta <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'capped', true);
  END IF;

  INSERT INTO public.invite_credit_ledger (user_id, delta, reason, reference_type, reference_id)
  VALUES (p_user_id, v_delta, p_reason, NULLIF(v_ref_type, ''), CASE WHEN v_ref_id = '' THEN NULL ELSE p_reference_id END);

  RETURN jsonb_build_object('ok', true, 'granted', v_delta);
END;
$$;

COMMENT ON FUNCTION public.grant_invite_reserve_for_milestone_for_user(uuid, text, text, uuid) IS 'Internal: grant reserve for any user. Only call from SECURITY DEFINER (record_invitee_active, record_invitee_org_created). Not granted to authenticated.';

-- Do not grant EXECUTE to authenticated; only definer functions in same schema (same owner) can call it.

-- 2) Record invitee active: invitee (auth.uid()) marks self active; updates attribution; grants inviter +1.
CREATE OR REPLACE FUNCTION public.record_invitee_active()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attribution_id uuid;
  v_inviter_id uuid;
  v_grant jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT id, inviter_user_id INTO v_attribution_id, v_inviter_id
  FROM public.invite_attributions
  WHERE invitee_user_id = auth.uid() AND attribution_status = 'redeemed'
  LIMIT 1;

  IF v_attribution_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'updated', false, 'reason', 'no_attribution');
  END IF;

  UPDATE public.invite_attributions
  SET became_active_at = now(), attribution_status = 'invitee_active'
  WHERE id = v_attribution_id;

  v_grant := public.grant_invite_reserve_for_milestone_for_user(v_inviter_id, 'invitee_active', 'attribution', v_attribution_id);

  RETURN jsonb_build_object('ok', true, 'updated', true, 'grant', v_grant);
END;
$$;

COMMENT ON FUNCTION public.record_invitee_active() IS 'Invitee (auth.uid()) marks self as active. Updates attribution to invitee_active and grants inviter +1 reserve. Idempotent: only updates when status = redeemed.';

GRANT EXECUTE ON FUNCTION public.record_invitee_active() TO authenticated;

-- 3) Record invitee org created: invitee (auth.uid()) records that they created this org; updates attribution; grants inviter +2.
CREATE OR REPLACE FUNCTION public.record_invitee_org_created(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_id uuid;
  v_attribution_id uuid;
  v_is_member int;
  v_grant jsonb;
BEGIN
  IF auth.uid() IS NULL OR p_org_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  SELECT 1 INTO v_is_member
  FROM public.org_members
  WHERE org_id = p_org_id AND user_id = auth.uid()
  LIMIT 1;
  IF v_is_member IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_org_member');
  END IF;

  SELECT id, inviter_user_id INTO v_attribution_id, v_inviter_id
  FROM public.invite_attributions
  WHERE invitee_user_id = auth.uid()
    AND attribution_status IN ('redeemed', 'invitee_active')
  LIMIT 1;

  IF v_attribution_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'updated', false, 'reason', 'no_attribution');
  END IF;

  UPDATE public.invite_attributions
  SET invitee_org_id = p_org_id, attribution_status = 'org_created'
  WHERE id = v_attribution_id;

  v_grant := public.grant_invite_reserve_for_milestone_for_user(v_inviter_id, 'org_active', 'org', p_org_id);

  RETURN jsonb_build_object('ok', true, 'updated', true, 'grant', v_grant);
END;
$$;

COMMENT ON FUNCTION public.record_invitee_org_created(uuid) IS 'Invitee (auth.uid()) records that they created this org. Caller must be org member. Updates attribution to org_created and grants inviter +2 reserve. Idempotent per org (only one attribution row per invitee).';

GRANT EXECUTE ON FUNCTION public.record_invitee_org_created(uuid) TO authenticated;
