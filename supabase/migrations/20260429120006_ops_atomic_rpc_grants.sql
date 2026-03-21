-- One statement: grants/comments for ops_atomic_* (avoids multi-command prepared statement errors).
DO $ops_grants$
BEGIN
  EXECUTE 'COMMENT ON FUNCTION public.ops_atomic_comp_grant(uuid, text, uuid, timestamptz, text, jsonb, boolean) IS '
    || quote_literal('Atomic comp grant: optional supersede active comp rows, insert entitlement, insert audit row(s). Service role only.');
  EXECUTE 'COMMENT ON FUNCTION public.ops_atomic_discount_metadata(uuid, text, uuid, timestamptz, text, jsonb) IS '
    || quote_literal('Atomic discount metadata: supersede prior active rows, insert, audit. Service role only.');
  EXECUTE 'COMMENT ON FUNCTION public.ops_atomic_plan_override(uuid, text, uuid, timestamptz, text, jsonb) IS '
    || quote_literal('Atomic plan override: supersede prior active rows, insert, audit. Service role only.');
  EXECUTE 'COMMENT ON FUNCTION public.ops_atomic_revoke_entitlement(uuid, uuid, text) IS '
    || quote_literal('Atomic revoke: lock row, set revoked_at, audit. Service role only.');
  EXECUTE 'COMMENT ON FUNCTION public.ops_atomic_usage_counter_reset(uuid, text, uuid, date, text, text, text) IS '
    || quote_literal('Atomic usage reset: lock counter row, zero count, audit. Service role only.');

  EXECUTE 'REVOKE ALL ON FUNCTION public.ops_atomic_comp_grant(uuid, text, uuid, timestamptz, text, jsonb, boolean) FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION public.ops_atomic_discount_metadata(uuid, text, uuid, timestamptz, text, jsonb) FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION public.ops_atomic_plan_override(uuid, text, uuid, timestamptz, text, jsonb) FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION public.ops_atomic_revoke_entitlement(uuid, uuid, text) FROM PUBLIC';
  EXECUTE 'REVOKE ALL ON FUNCTION public.ops_atomic_usage_counter_reset(uuid, text, uuid, date, text, text, text) FROM PUBLIC';

  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ops_atomic_comp_grant(uuid, text, uuid, timestamptz, text, jsonb, boolean) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ops_atomic_discount_metadata(uuid, text, uuid, timestamptz, text, jsonb) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ops_atomic_plan_override(uuid, text, uuid, timestamptz, text, jsonb) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ops_atomic_revoke_entitlement(uuid, uuid, text) TO service_role';
  EXECUTE 'GRANT EXECUTE ON FUNCTION public.ops_atomic_usage_counter_reset(uuid, text, uuid, date, text, text, text) TO service_role';
END;
$ops_grants$;
