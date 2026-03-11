-- Personal invite code per profile: 10-char alphanumeric, unique. Each user can invite up to 5 people via this code.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS personal_invite_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_personal_invite_code
  ON public.profiles (upper(btrim(personal_invite_code)))
  WHERE personal_invite_code IS NOT NULL AND btrim(personal_invite_code) != '';

COMMENT ON COLUMN public.profiles.personal_invite_code IS 'Unique 10-char alphanumeric code others can redeem; each profile can have up to 5 redemptions (invitees).';

-- Generate 10-char alphanumeric (safe charset: no 0/O, 1/l/I)
CREATE OR REPLACE FUNCTION public.gen_personal_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..10 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Backfill existing profiles with a unique personal_invite_code
DO $$
DECLARE
  r record;
  c text;
  done int;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE personal_invite_code IS NULL OR btrim(personal_invite_code) = '' LOOP
    done := 0;
    WHILE done = 0 LOOP
      c := public.gen_personal_invite_code();
      UPDATE public.profiles
      SET personal_invite_code = c
      WHERE id = r.id
        AND (personal_invite_code IS NULL OR btrim(personal_invite_code) = '')
        AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE upper(btrim(p2.personal_invite_code)) = upper(c) AND p2.id != r.id);
      GET DIAGNOSTICS done = ROW_COUNT;
    END LOOP;
  END LOOP;
END;
$$;
