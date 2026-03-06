-- Slice 2: Speaker applications — pitch, topic, status declined/withdrawn, max 10 approved (RPC)

-- 1) Add pitch and topic
ALTER TABLE public.speaker_requests ADD COLUMN IF NOT EXISTS pitch text;
ALTER TABLE public.speaker_requests ADD COLUMN IF NOT EXISTS topic text;
COMMENT ON COLUMN public.speaker_requests.pitch IS 'Applicant pitch for speaking.';
COMMENT ON COLUMN public.speaker_requests.topic IS 'Proposed topic.';

-- 2) Migrate rejected -> declined, then extend status constraint
UPDATE public.speaker_requests SET status = 'declined' WHERE status = 'rejected';

DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'speaker_requests' AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%status%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.speaker_requests DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.speaker_requests ADD CONSTRAINT speaker_requests_status_check
  CHECK (status IN ('pending', 'approved', 'declined', 'withdrawn'));

-- 3) Atomic approve: enforces max 10 approved per space; host-only
CREATE OR REPLACE FUNCTION public.approve_speaker_request(p_request_id uuid, p_host_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space_id uuid;
  v_current_status text;
  v_approved_count int;
BEGIN
  SELECT space_id, status INTO v_space_id, v_current_status
  FROM public.speaker_requests
  WHERE id = p_request_id;

  IF v_space_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.spaces WHERE id = v_space_id AND host_profile_id = p_host_profile_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF v_current_status != 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_pending');
  END IF;

  SELECT count(*) INTO v_approved_count
  FROM public.speaker_requests
  WHERE space_id = v_space_id AND status = 'approved';

  IF v_approved_count >= 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'max_approved', 'approved_count', v_approved_count);
  END IF;

  UPDATE public.speaker_requests
  SET status = 'approved', updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON FUNCTION public.approve_speaker_request(uuid, uuid) IS 'Atomically approve a speaker request if space has fewer than 10 approved. Caller must be host.';
