-- Notification log: rate limit outbound emails (e.g. collab_request_new).
-- Server-only; no RLS for app users. Service role only.

CREATE TABLE public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  ref_id uuid
);

CREATE INDEX idx_notification_log_user_type_created
  ON public.notification_log (user_id, type, created_at DESC);

COMMENT ON TABLE public.notification_log IS 'Rate limit outbound email notifications; server/service_role only.';

-- No RLS policies: table is accessed only with service role. Optionally disable RLS for clarity.
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Deny all for anon/authenticated; service_role bypasses RLS
CREATE POLICY "notification_log_service_only"
  ON public.notification_log
  FOR ALL
  USING (false)
  WITH CHECK (false);
