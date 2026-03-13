-- Ensure each user has 5 individual invite codes (each usable once). Used by GET /api/invites/me.
-- source_reason = 'initial' for these 5; no expiry so they don't expire like wallet-issued.

CREATE OR REPLACE FUNCTION public.ensure_initial_invite_codes(p_user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_count int;
  v_to_create int;
  v_code text;
  v_i int;
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN;
  END IF;

  -- Grant 5 one-time codes once per user (no replenishment; use Invite wallet for more)
  SELECT COUNT(*)::int INTO v_count
  FROM public.invite_codes
  WHERE owner_user_id = v_user_id AND source_reason = 'initial';

  IF v_count > 0 THEN
    RETURN;
  END IF;

  v_to_create := 5;

  FOR v_i IN 1 .. v_to_create LOOP
    LOOP
      v_code := public.gen_wallet_invite_code();
      IF NOT EXISTS (SELECT 1 FROM public.invite_codes WHERE upper(btrim(code)) = upper(v_code))
         AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE upper(btrim(COALESCE(personal_invite_code, ''))) = upper(v_code)) THEN
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.invite_codes (
      code, owner_user_id, issued_by_type, issued_by_id, issued_by_profile_id, status, expires_at, source_reason
    )
    VALUES (
      v_code, v_user_id, 'profile', v_user_id, v_user_id, 'available', NULL, 'initial'
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_initial_invite_codes IS 'Ensures the current user has 5 one-time invite codes (source_reason=initial). Each code can be used once. Called from /api/invites/me.';

GRANT EXECUTE ON FUNCTION public.ensure_initial_invite_codes TO authenticated;
