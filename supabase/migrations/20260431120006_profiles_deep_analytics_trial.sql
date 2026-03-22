-- 3-day full deep-analytics trial for free-tier users (first touch via service role).
-- SECURITY DEFINER RPC: only service_role may execute; used from apps/web /api/analytics/x.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deep_analytics_trial_ends_at timestamptz;

COMMENT ON COLUMN public.profiles.deep_analytics_trial_ends_at IS
  'UTC instant when the one-time 3-day deep analytics (charts) trial ends; set on first eligible request.';

CREATE OR REPLACE FUNCTION public.touch_deep_analytics_trial(p_profile_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz;
BEGIN
  IF p_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.profiles
  SET deep_analytics_trial_ends_at = COALESCE(
    deep_analytics_trial_ends_at,
    (timezone('utc', now()) + interval '3 days')
  )
  WHERE id = p_profile_id
  RETURNING deep_analytics_trial_ends_at INTO v_end;

  RETURN v_end;
END;
$$;

COMMENT ON FUNCTION public.touch_deep_analytics_trial(uuid) IS
  'Idempotent: sets deep_analytics_trial_ends_at to now+3d if null; returns current trial end.';

REVOKE ALL ON FUNCTION public.touch_deep_analytics_trial(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_deep_analytics_trial(uuid) TO service_role;
