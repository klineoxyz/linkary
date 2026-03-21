-- Atomic ops writes: supersede + insert + audit (and usage reset + audit) in one transaction.
-- Invoked only via service_role (CRM API after requireOpsApiAccess + role checks).

-- -----------------------------------------------------------------------------
-- 1) Comp grant (+ optional supersede of active comp rows for subject)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ops_atomic_comp_grant(
  p_actor_user_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_expires_at timestamptz,
  p_reason text,
  p_payload_json jsonb,
  p_replace_existing boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_new_id uuid;
  v_prior_ids uuid[];
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
  IF NOT (
    p_payload_json ? 'scopes'
    AND jsonb_typeof(p_payload_json->'scopes') = 'array'
    AND jsonb_array_length(p_payload_json->'scopes') >= 1
  ) THEN
    RAISE EXCEPTION 'OPS_SCOPES_REQUIRED';
  END IF;

  v_prior_ids := COALESCE(
    (
      SELECT array_agg(sub.id)
      FROM (
        UPDATE public.platform_ops_entitlements e
        SET revoked_at = v_now
        WHERE e.subject_type = p_subject_type
          AND e.subject_id = p_subject_id
          AND e.kind = 'comp_grant'
          AND e.revoked_at IS NULL
          AND p_replace_existing = true
        RETURNING e.id
      ) sub
    ),
    ARRAY[]::uuid[]
  );

  INSERT INTO public.platform_ops_entitlements (
    subject_type, subject_id, kind, expires_at, payload_json, reason, created_by
  ) VALUES (
    p_subject_type, p_subject_id, 'comp_grant', p_expires_at,
    p_payload_json, trim(p_reason), p_actor_user_id
  )
  RETURNING id INTO v_new_id;

  IF cardinality(v_prior_ids) > 0 THEN
    INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
    VALUES (
      p_actor_user_id,
      'ops.entitlement.comp_grant.supersede_revoke',
      p_subject_type,
      p_subject_id,
      jsonb_build_object('revoked_entitlement_ids', to_jsonb(v_prior_ids)),
      trim(p_reason)
    );
  END IF;

  INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
  VALUES (
    p_actor_user_id,
    'ops.entitlement.comp_grant.create',
    p_subject_type,
    p_subject_id,
    jsonb_build_object(
      'entitlement_id', v_new_id,
      'scopes', p_payload_json->'scopes',
      'expires_at', to_jsonb(p_expires_at),
      'replace_existing', to_jsonb(p_replace_existing),
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

COMMENT ON FUNCTION public.ops_atomic_comp_grant IS
  'Atomic comp grant: optional supersede active comp rows, insert entitlement, insert audit row(s). Service role only.';

-- -----------------------------------------------------------------------------
-- 2) Discount metadata (always supersede prior active discount_metadata)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ops_atomic_discount_metadata(
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

  v_prior_ids := COALESCE(
    (
      SELECT array_agg(sub.id)
      FROM (
        UPDATE public.platform_ops_entitlements e
        SET revoked_at = v_now
        WHERE e.subject_type = p_subject_type
          AND e.subject_id = p_subject_id
          AND e.kind = 'discount_metadata'
          AND e.revoked_at IS NULL
        RETURNING e.id
      ) sub
    ),
    ARRAY[]::uuid[]
  );

  INSERT INTO public.platform_ops_entitlements (
    subject_type, subject_id, kind, expires_at, payload_json, reason, created_by
  ) VALUES (
    p_subject_type, p_subject_id, 'discount_metadata', p_expires_at,
    p_payload_json, trim(p_reason), p_actor_user_id
  )
  RETURNING id INTO v_new_id;

  IF cardinality(v_prior_ids) > 0 THEN
    INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
    VALUES (
      p_actor_user_id,
      'ops.entitlement.discount_metadata.supersede_revoke',
      p_subject_type,
      p_subject_id,
      jsonb_build_object('revoked_entitlement_ids', to_jsonb(v_prior_ids)),
      trim(p_reason)
    );
  END IF;

  INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
  VALUES (
    p_actor_user_id,
    'ops.entitlement.discount_metadata.create',
    p_subject_type,
    p_subject_id,
    p_payload_json || jsonb_build_object(
      'entitlement_id', v_new_id,
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

COMMENT ON FUNCTION public.ops_atomic_discount_metadata IS
  'Atomic discount metadata: supersede prior active rows, insert, audit. Service role only.';

-- -----------------------------------------------------------------------------
-- 3) Plan override (always supersede prior active plan_override)
-- -----------------------------------------------------------------------------
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

  v_prior_ids := COALESCE(
    (
      SELECT array_agg(sub.id)
      FROM (
        UPDATE public.platform_ops_entitlements e
        SET revoked_at = v_now
        WHERE e.subject_type = p_subject_type
          AND e.subject_id = p_subject_id
          AND e.kind = 'plan_override'
          AND e.revoked_at IS NULL
        RETURNING e.id
      ) sub
    ),
    ARRAY[]::uuid[]
  );

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

COMMENT ON FUNCTION public.ops_atomic_plan_override IS
  'Atomic plan override: supersede prior active rows, insert, audit. Service role only.';

-- -----------------------------------------------------------------------------
-- 4) Revoke entitlement by id (row locked; audit in same txn)
-- -----------------------------------------------------------------------------
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

COMMENT ON FUNCTION public.ops_atomic_revoke_entitlement IS
  'Atomic revoke: lock row, set revoked_at, audit. Service role only.';

-- -----------------------------------------------------------------------------
-- 5) Usage counter reset (row locked; audit in same txn)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ops_atomic_usage_counter_reset(
  p_actor_user_id uuid,
  p_owner_type text,
  p_owner_id uuid,
  p_period_start date,
  p_metric_key text,
  p_reason text,
  p_admin_note text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_counter_id uuid;
  v_prior int;
  v_mk text := trim(coalesce(p_metric_key, ''));
  v_note text := nullif(trim(coalesce(p_admin_note, '')), '');
BEGIN
  IF p_owner_type NOT IN ('profile', 'org') THEN
    RAISE EXCEPTION 'OPS_INVALID_OWNER';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'OPS_REASON_REQUIRED';
  END IF;
  IF v_mk = '' THEN
    RAISE EXCEPTION 'OPS_METRIC_REQUIRED';
  END IF;

  SELECT c.id, c.count
  INTO v_counter_id, v_prior
  FROM public.plan_usage_counters c
  WHERE c.owner_type = p_owner_type
    AND c.owner_id = p_owner_id
    AND c.period_start = p_period_start
    AND c.metric_key = v_mk
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OPS_ROW_NOT_FOUND';
  END IF;

  UPDATE public.plan_usage_counters
  SET count = 0, updated_at = v_now
  WHERE id = v_counter_id;

  INSERT INTO public.platform_audit_log (actor_user_id, action, target_type, target_id, payload_json, reason)
  VALUES (
    p_actor_user_id,
    'ops.usage_counter.reset',
    p_owner_type,
    p_owner_id,
    jsonb_strip_nulls(jsonb_build_object(
      'counter_id', v_counter_id,
      'period_start', to_jsonb(p_period_start),
      'metric_key', to_jsonb(v_mk),
      'prior_count', to_jsonb(v_prior),
      'admin_note', CASE WHEN v_note IS NULL THEN NULL ELSE to_jsonb(v_note) END
    )),
    trim(p_reason)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'counter_id', v_counter_id,
    'prior_count', v_prior
  );
END;
$fn$;

COMMENT ON FUNCTION public.ops_atomic_usage_counter_reset IS
  'Atomic usage reset: lock counter row, zero count, audit. Service role only.';

-- -----------------------------------------------------------------------------
-- Grants: service_role only (CRM uses service client after session gate)
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ops_atomic_comp_grant(uuid, text, uuid, timestamptz, text, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_atomic_discount_metadata(uuid, text, uuid, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_atomic_plan_override(uuid, text, uuid, timestamptz, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_atomic_revoke_entitlement(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ops_atomic_usage_counter_reset(uuid, text, uuid, date, text, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.ops_atomic_comp_grant(uuid, text, uuid, timestamptz, text, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_atomic_discount_metadata(uuid, text, uuid, timestamptz, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_atomic_plan_override(uuid, text, uuid, timestamptz, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_atomic_revoke_entitlement(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ops_atomic_usage_counter_reset(uuid, text, uuid, date, text, text, text) TO service_role;
