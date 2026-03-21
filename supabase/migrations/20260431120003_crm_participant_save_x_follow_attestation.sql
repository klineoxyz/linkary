-- Allow enrolled creators to update only x_follow_attestation on their participant row (no broad participant UPDATE).
CREATE OR REPLACE FUNCTION public.crm_participant_save_x_follow_attestation(
  p_campaign_id uuid,
  p_attestation jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_pid uuid := public.crm_current_profile_id();
  v_row_id uuid;
BEGIN
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  UPDATE public.crm_campaign_participants
  SET
    x_follow_attestation = COALESCE(p_attestation, '{}'::jsonb),
    updated_at = now()
  WHERE campaign_id = p_campaign_id
    AND participant_profile_id = v_pid
  RETURNING id INTO v_row_id;

  IF v_row_id IS NULL THEN
    RAISE EXCEPTION 'participant row not found or not allowed';
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crm_participant_save_x_follow_attestation(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_participant_save_x_follow_attestation(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.crm_participant_save_x_follow_attestation(uuid, jsonb) IS
  'Creator-only: sets crm_campaign_participants.x_follow_attestation for the current profile and campaign; no other columns.';
