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
