-- Safe way to read own X connection: SECURITY DEFINER function so client always gets
-- their row even if RLS/session timing would block the direct table SELECT.
-- Returns at most one row; auth.uid() must be set (caller must be authenticated).

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

COMMENT ON FUNCTION public.get_my_social_x() IS 'Returns current user X connection (one row). SECURITY DEFINER so Integrations UI can read own row without relying on table RLS timing.';

GRANT EXECUTE ON FUNCTION public.get_my_social_x() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_social_x() TO anon;
