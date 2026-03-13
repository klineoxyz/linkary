-- Fix: record_invite_package_attribution must grant to the inviter, not the caller.
-- grant_invite_reserve_for_milestone enforces grantee = auth.uid(); when called from API, auth.uid() is the org member.
-- Use grant_invite_reserve_for_milestone_for_user so the inviter receives +3.
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

  PERFORM public.grant_invite_reserve_for_milestone_for_user(v_inviter_id, 'package_purchase', 'package_purchase', p_purchase_id);

  RETURN jsonb_build_object('ok', true, 'attributions_updated', 1, 'reserve_grants', 1);
END;
$$;

COMMENT ON FUNCTION public.record_invite_package_attribution(uuid, uuid, text, int) IS 'First-touch: single winning inviter = earliest attribution (created_at) for this org in 90-day window. Updates that row and grants inviter +3 via grant_invite_reserve_for_milestone_for_user.';
