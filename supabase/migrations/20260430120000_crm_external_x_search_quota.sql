-- Atomic consume / refund for CRM external X profile search (org-scoped monthly cap).

CREATE OR REPLACE FUNCTION public.crm_try_consume_external_x_search_quota(
  p_org_id uuid,
  p_period_start date,
  p_metric_key text,
  p_cap integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid;
  v_count int;
  v_now timestamptz := now();
BEGIN
  IF p_cap < 1 THEN
    RAISE EXCEPTION 'CRM_QUOTA_INVALID_CAP';
  END IF;

  INSERT INTO public.plan_usage_counters (owner_type, owner_id, period_start, metric_key, count, updated_at)
  VALUES ('org', p_org_id, p_period_start, p_metric_key, 0, v_now)
  ON CONFLICT (owner_type, owner_id, period_start, metric_key) DO NOTHING;

  SELECT c.id, c.count INTO v_id, v_count
  FROM public.plan_usage_counters c
  WHERE c.owner_type = 'org'
    AND c.owner_id = p_org_id
    AND c.period_start = p_period_start
    AND c.metric_key = p_metric_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CRM_QUOTA_ROW_MISSING';
  END IF;

  IF v_count >= p_cap THEN
    RETURN jsonb_build_object('ok', false, 'count', v_count, 'cap', p_cap);
  END IF;

  UPDATE public.plan_usage_counters
  SET count = v_count + 1, updated_at = v_now
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'count', v_count + 1, 'cap', p_cap);
END;
$fn$;

COMMENT ON FUNCTION public.crm_try_consume_external_x_search_quota IS
  'Locks org usage row, increments if under cap. Service role only.';

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

COMMENT ON FUNCTION public.crm_refund_external_x_search_slot IS
  'Decrements org external X search counter by 1 (min 0) when live fetch failed after consume. Service role only.';

REVOKE ALL ON FUNCTION public.crm_try_consume_external_x_search_quota(uuid, date, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_refund_external_x_search_slot(uuid, date, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.crm_try_consume_external_x_search_quota(uuid, date, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_refund_external_x_search_slot(uuid, date, text) TO service_role;
