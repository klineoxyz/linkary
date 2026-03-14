-- Discovery API audit log (privacy-safe). Do not log raw query text or PII beyond user_id.
CREATE TABLE IF NOT EXISTS public.discovery_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  has_query boolean NOT NULL DEFAULT false,
  result_count int NOT NULL DEFAULT 0,
  outcome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discovery_access_log_user_id ON public.discovery_access_log (user_id);
CREATE INDEX IF NOT EXISTS idx_discovery_access_log_created_at ON public.discovery_access_log (created_at);
CREATE INDEX IF NOT EXISTS idx_discovery_access_log_outcome ON public.discovery_access_log (outcome);

ALTER TABLE public.discovery_access_log ENABLE ROW LEVEL SECURITY;

-- Only service role (and superuser) can insert/select; no anon or authenticated access.
REVOKE ALL ON public.discovery_access_log FROM anon;
REVOKE ALL ON public.discovery_access_log FROM authenticated;
REVOKE ALL ON public.discovery_access_log FROM PUBLIC;
GRANT SELECT, INSERT ON public.discovery_access_log TO service_role;

COMMENT ON TABLE public.discovery_access_log IS 'Privacy-safe audit log for discovery API access. Logs user_id, endpoint, has_query, result_count, outcome. No raw query or PII.';
