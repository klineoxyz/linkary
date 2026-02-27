-- P8: Optional follow-up note from requester after a request is accepted (one message, no full chat).
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS requester_followup_note text;

COMMENT ON COLUMN public.collab_requests.requester_followup_note IS 'Optional follow-up from requester after status = accepted; max 500 chars.';

-- Allow requester to update only when status is already accepted (so they can set requester_followup_note).
-- API enforces that requester can only set this column, not status or reply_note.
CREATE POLICY "collab_requests_update_requester_followup"
  ON public.collab_requests FOR UPDATE
  USING (requester_profile_id = auth.uid() AND status = 'accepted')
  WITH CHECK (requester_profile_id = auth.uid());
