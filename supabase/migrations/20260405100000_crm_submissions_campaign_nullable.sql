-- Allow submissions for tasks without a campaign (e.g. manual tasks)
ALTER TABLE public.crm_submissions
  ALTER COLUMN campaign_id DROP NOT NULL;

-- RLS already allows participant_profile_id = current_user for SELECT/UPDATE; no change needed.
