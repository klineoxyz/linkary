-- P6: Optional reply note when target accepts a collab request.
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS reply_note text;

COMMENT ON COLUMN public.collab_requests.reply_note IS 'Optional note from target when accepting; only set when status = accepted.';
