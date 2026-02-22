-- Rate limiting table and atomic consume function (no new vendor; Vercel-friendly).
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Atomic consume: returns allowed, remaining, reset_at. Resets window when expired.
CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
RETURNS TABLE (allowed boolean, remaining int, reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_end timestamptz;
  v_window_start timestamptz;
  v_count int;
BEGIN
  IF p_key IS NULL OR p_key = '' OR p_limit < 1 OR p_window_seconds < 1 THEN
    allowed := false;
    remaining := 0;
    reset_at := v_now;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO public.rate_limits (key, window_start, count, updated_at)
  VALUES (p_key, v_now, 1, v_now)
  ON CONFLICT (key) DO UPDATE SET
    window_start = CASE
      WHEN v_now >= rate_limits.window_start + (p_window_seconds || ' seconds')::interval
      THEN v_now
      ELSE rate_limits.window_start
    END,
    count = CASE
      WHEN v_now >= rate_limits.window_start + (p_window_seconds || ' seconds')::interval
      THEN 1
      ELSE rate_limits.count + 1
    END,
    updated_at = v_now
  RETURNING rate_limits.window_start, rate_limits.count INTO v_window_start, v_count;

  v_window_end := v_window_start + (p_window_seconds || ' seconds')::interval;
  allowed := v_count <= p_limit;
  remaining := greatest(0, p_limit - v_count);
  reset_at := v_window_end;
  RETURN NEXT;
END;
$$;

COMMENT ON TABLE public.rate_limits IS 'Rate limit counters per key; window resets after window_seconds.';
COMMENT ON FUNCTION public.consume_rate_limit IS 'Atomically consume one request; returns allowed, remaining, reset_at.';
