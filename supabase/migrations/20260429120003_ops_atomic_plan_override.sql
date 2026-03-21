CREATE OR REPLACE FUNCTION public.ops_atomic_plan_override(
  p_actor_user_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_expires_at timestamptz,
  p_reason text,
  p_payload_json jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_new_id uuid;
  v_prior_ids uuid[];
  v_plan text;
BEGIN
  IF p_subject_type NOT IN ('profile', 'org') THEN
    RAISE EXCEPTION 'OPS_INVALID_SUBJECT';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'OPS_REASON_REQUIRED';
  END IF;
  IF p_expires_at <= v_now THEN
    RAISE EXCEPTION 'OPS_EXPIRES_INVALID';
  END IF;
  IF p_payload_json IS NULL OR jsonb_typeof(p_payload_json) <> 'object' THEN
    RAISE EXCEPTION 'OPS_PAYLOAD_INVALID';
  END IF;
  v_plan := p_payload_json->>'plan_key';
  IF v_plan IS NULL OR length(trim(v_plan)) = 0 THEN
    RAISE EXCEPTION 'OPS_PLAN_KEY_REQUIRED';
  END IF;

  WITH sup_rev AS (
    UPDATE public.platform_ops_entitlements e
    SET revoked_at = v_now
    WHERE e.subject_type = p_subject_type
      AND e.subject_id = p_subject_id
      AND e.kind = 'plan_override'
      AND e.revoked_at IS NULL
    RETURNING e.id
  )
  SELECT coalesce((SELECT array_agg(id) FROM sup_rev), ARRAY[]::uuid[]) INTO v_prior_ids;

  INSERT INTO public.platform_ops_entitlements (
    subject_type, subject_id, kind, expires_at, payload_json, reason, created_by
  ) VALUES (
    p_subject_type, p_subject_id, 'plan_override', p_expires_at,
    p_payload_json, trim(p_reason), p_actor_user_id
  )
  RETURNING id INTO v_new_id;

  IF cardinality(v_prior_ids) > 0 THEN
    INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
    VALUES (
      p_actor_user_id,
      'ops.entitlement.plan_override.supersede_revoke',
      p_subject_type,
      p_subject_id,
      jsonb_build_object('revoked_entitlement_ids', to_jsonb(v_prior_ids)),
      trim(p_reason)
    );
  END IF;

  INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
  VALUES (
    p_actor_user_id,
    'ops.entitlement.plan_override.create',
    p_subject_type,
    p_subject_id,
    jsonb_build_object(
      'entitlement_id', v_new_id,
      'plan_key', v_plan,
      'expires_at', to_jsonb(p_expires_at),
      'prior_revoked_ids', to_jsonb(v_prior_ids)
    ),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'entitlement_id', v_new_id,
    'prior_revoked_ids', to_jsonb(v_prior_ids)
  );
END;
$fn$;
