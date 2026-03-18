-- Creator discovery: program invites get inbox seen timestamp (job invites use org_job_invites.viewed_at).

ALTER TABLE public.creator_program_invites
  ADD COLUMN IF NOT EXISTS invitee_inbox_seen_at timestamptz;

COMMENT ON COLUMN public.creator_program_invites.invitee_inbox_seen_at IS 'Set when creator opens Org invites inbox; unread until then.';
