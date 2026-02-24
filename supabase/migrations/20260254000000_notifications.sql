-- =============================================================================
-- Notifications: recipient_profile_id, type, entity_type, entity_id, payload, read_at, created_at
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  entity_type text,
  entity_id uuid,
  payload jsonb DEFAULT '{}',
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications (recipient_profile_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created ON public.notifications (recipient_profile_id, created_at DESC);

COMMENT ON TABLE public.notifications IS 'In-app notifications; type e.g. connection_request, ambassador_invite, application_submitted, application_accepted, deal_delivered, etc.';

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (recipient_profile_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (recipient_profile_id = auth.uid());
