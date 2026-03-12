-- Package attribution: record purchase for an invited org and grant inviter reserve (90-day window).
-- Billing/purchase flow should call this when an org completes a package purchase.

CREATE INDEX IF NOT EXISTS idx_invite_attributions_org_created
  ON public.invite_attributions (invitee_org_id, created_at DESC) WHERE invitee_org_id IS NOT NULL;

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
  v_attribution record;
  v_updated int := 0;
  v_grants int := 0;
  v_attribution_window_days int := 90;
BEGIN
  IF p_org_id IS NULL OR p_purchase_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_input');
  END IF;

  FOR v_attribution IN
    SELECT id, inviter_user_id
    FROM public.invite_attributions
    WHERE invitee_org_id = p_org_id
      AND created_at >= (now() - (v_attribution_window_days || ' days')::interval)
      AND attribution_status != 'package_purchased'
  LOOP
    UPDATE public.invite_attributions
    SET
      package_purchase_id = p_purchase_id,
      package_type = p_package_type,
      package_amount_cents = p_amount_cents,
      package_purchased_at = now(),
      attribution_status = 'package_purchased'
    WHERE id = v_attribution.id;
    v_updated := v_updated + 1;

    IF (SELECT (public.grant_invite_reserve_for_milestone(
      v_attribution.inviter_user_id,
      'package_purchase',
      'package_purchase',
      p_purchase_id
    )->>'granted')::int) > 0 THEN
      v_grants := v_grants + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'attributions_updated', v_updated, 'reserve_grants', v_grants);
END;
$$;

COMMENT ON FUNCTION public.record_invite_package_attribution IS 'When an org buys a package: updates invite_attributions for that org (90-day window) and grants +1 reserve to inviter per attribution. Idempotent per attribution. Call from billing webhook or after purchase.';

GRANT EXECUTE ON FUNCTION public.record_invite_package_attribution TO service_role;
GRANT EXECUTE ON FUNCTION public.record_invite_package_attribution TO authenticated;
