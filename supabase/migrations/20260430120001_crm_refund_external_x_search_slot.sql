CREATE OR REPLACE FUNCTION public.crm_refund_external_x_search_slot(
  p_org_id uuid,
  p_period_start date,
  p_metric_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_now timestamptz := now();
  v_id uuid;
  v_count int;
BEGIN
  SELECT c.id, c.count INTO v_id, v_count
  FROM public.plan_usage_counters c
  WHERE c.owner_type = 'org'
    AND c.owner_id = p_org_id
    AND c.period_start = p_period_start
    AND c.metric_key = p_metric_key
  FOR UPDATE;

  IF NOT FOUND OR v_count <= 0 THEN
    RETURN jsonb_build_object('ok', true, 'count', coalesce(v_count, 0), 'refunded', false);
  END IF;

  UPDATE public.plan_usage_counters
  SET count = v_count - 1, updated_at = v_now
  WHERE id = v_id
  RETURNING count INTO v_count;

  RETURN jsonb_build_object('ok', true, 'count', v_count, 'refunded', true);
END;
$fn$;
