-- Align invite-code superadmin replenishment with app: match platform superadmin on
-- twitter_username OR username (normalized), same handle as PLATFORM_SUPERADMIN_NORMALIZED_HANDLES in @linkary/plan-key.

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
  v_is_superadmin boolean := false;
BEGIN
  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RETURN;
  END IF;

  SELECT (
    LOWER(TRIM(BOTH '@' FROM COALESCE(twitter_username, ''))) = 'muazxinthi'
    OR LOWER(TRIM(BOTH '@' FROM COALESCE(username, ''))) = 'muazxinthi'
  )
  INTO v_is_superadmin FROM public.profiles WHERE id = v_user_id LIMIT 1;

  IF v_is_superadmin THEN
    SELECT COUNT(*)::int INTO v_count
    FROM public.invite_codes
    WHERE owner_user_id = v_user_id
      AND status = 'available'
      AND (expires_at IS NULL OR expires_at > now());

    v_to_create := GREATEST(0, 5 - v_count);
  ELSE
    SELECT COUNT(*)::int INTO v_count
    FROM public.invite_codes
    WHERE owner_user_id = v_user_id AND source_reason = 'initial';

    IF v_count > 0 THEN
      RETURN;
    END IF;
    v_to_create := 5;
  END IF;

  IF v_to_create <= 0 THEN
    RETURN;
  END IF;

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
      v_code, v_user_id, 'profile', v_user_id, v_user_id, 'available', NULL, CASE WHEN v_is_superadmin THEN 'admin' ELSE 'initial' END
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_initial_invite_codes IS 'Ensures current user has 5 one-time invite codes. Normal users: once (source_reason=initial). Platform superadmin (username or twitter_username muazxinthi): always replenish to 5 (source_reason=admin).';
