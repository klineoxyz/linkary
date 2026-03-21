DO $crm_x_grants$
BEGIN
  EXECUTE 'COMMENT ON FUNCTION public.crm_try_consume_external_x_search_quota(uuid, date, text, integer) IS '
    || quote_literal('Locks org usage row, increments if under cap. Service role only.');
  EXECUTE 'COMMENT ON FUNCTION public.crm_refund_external_x_search_slot(uuid, date, text) IS '
    || quote_literal('Decrements org external X search counter by 1 (min 0) when live fetch failed after consume. Service role only.');

  EXECUTE 'REVOKE ALL ON FUNCTION public.crm_try_consume_external_x_search_quota(uuid, date, text, integer) FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION public.crm_refund_external_x_search_slot(uuid, date, text) FROM PUBLIC';

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.crm_try_consume_external_x_search_quota(uuid, date, text, integer) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.crm_refund_external_x_search_slot(uuid, date, text) TO service_role';
END;
$crm_x_grants$;
