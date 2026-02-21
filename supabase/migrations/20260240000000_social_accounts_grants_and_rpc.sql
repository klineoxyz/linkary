-- =============================================================================
-- Ensure social_accounts is usable by API and client (RLS already in 20260228).
-- Grants + get_my_social_x so Integrations and persist-social work.
-- =============================================================================

-- 1) Grants so authenticated and anon can SELECT/INSERT/UPDATE (RLS still enforces who)
GRANT SELECT ON public.social_accounts TO authenticated;
GRANT INSERT ON public.social_accounts TO authenticated;
GRANT UPDATE ON public.social_accounts TO authenticated;
GRANT SELECT ON public.social_accounts TO anon;
GRANT INSERT ON public.social_accounts TO anon;
GRANT UPDATE ON public.social_accounts TO anon;

-- 2) Ensure RPC exists for client fallback (same as 20260238)
CREATE OR REPLACE FUNCTION public.get_my_social_x()
RETURNS TABLE(connected boolean, username text, provider_user_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    (s.status = 'connected') AS connected,
    trim(both '@' from coalesce(s.username, '')) AS username,
    coalesce(trim(s.provider_user_id), '') AS provider_user_id
  FROM public.social_accounts s
  WHERE s.user_id = auth.uid()
    AND s.provider IN ('x', 'twitter')
    AND s.revoked_at IS NULL
  ORDER BY s.connected_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_my_social_x() IS 'Returns current user X connection. SECURITY DEFINER for Integrations fallback.';

GRANT EXECUTE ON FUNCTION public.get_my_social_x() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_social_x() TO anon;
