-- Bootstrap internal ops: resolve Linkary handle @muazxinthi → profiles.id (auth user id) → internal_ops_members.
-- Username is lookup-only; permission source of truth remains internal_ops_members.user_id = auth.users.id.
-- After apply: verify auth.users.email for the resolved user_id matches the expected operator account.

DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT p.id
  INTO v_uid
  FROM public.profiles p
  WHERE public.normalize_username(p.username) = public.normalize_username('muazxinthi')
  LIMIT 1;

  IF v_uid IS NULL THEN
    RAISE NOTICE 'internal_ops bootstrap: no profiles row for normalized username muazxinthi; skipped';
    RETURN;
  END IF;

  UPDATE public.internal_ops_members
  SET
    role = 'ops_super',
    revoked_at = NULL,
    note = COALESCE(
      NULLIF(BTRIM(COALESCE(note, '')), ''),
      'ops_super via migration: username lookup → profiles.id → user_id; confirm email in auth.users'
    )
  WHERE user_id = v_uid
    AND revoked_at IS NULL;

  IF NOT FOUND THEN
    INSERT INTO public.internal_ops_members (user_id, role, note)
    VALUES (
      v_uid,
      'ops_super',
      'ops_super via migration: username lookup → profiles.id → user_id; confirm email in auth.users'
    );
  END IF;
END $$;
