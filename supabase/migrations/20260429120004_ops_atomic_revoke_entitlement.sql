CREATE OR REPLACE FUNCTION public.ops_atomic_revoke_entitlement(
  p_actor_user_id uuid,
  p_entitlement_id uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_kind text;
  v_subject_type text;
  v_subject_id uuid;
  v_revoked_at timestamptz;
BEGIN
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'OPS_REASON_REQUIRED';
  END IF;

  SELECT e.kind, e.subject_type::text, e.subject_id, e.revoked_at
  INTO v_kind, v_subject_type, v_subject_id, v_revoked_at
  FROM public.platform_ops_entitlements e
  WHERE e.id = p_entitlement_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_NOT_FOUND';
  END IF;

  IF v_kind NOT IN ('comp_grant', 'discount_metadata', 'plan_override') THEN
    RAISE EXCEPTION 'OPS_INVALID_KIND';
  END IF;

  IF v_revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'OPS_ALREADY_REVOKED';
  END IF;

  UPDATE public.platform_ops_entitlements
  SET revoked_at = v_now
  WHERE id = p_entitlement_id AND revoked_at IS NULL;

  INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
  VALUES (
    p_actor_user_id,
    'ops.entitlement.revoke',
    v_subject_type,
    v_subject_id,
    jsonb_build_object(
      'entitlement_id', p_entitlement_id,
      'kind', v_kind,
      'revoked_at', to_jsonb(v_now)
    ),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'entitlement_id', p_entitlement_id,
    'revoked_at', to_jsonb(v_now)
  );
END;
$fn$;
