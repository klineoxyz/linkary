-- Profile slug history for 301 redirects when users change their Linkary slug.
-- When profiles.username is updated, we record (old_slug, new_slug) so /old_slug can 301 to /current_username.

CREATE TABLE IF NOT EXISTS public.profile_slug_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_slug text NOT NULL,
  new_slug text NOT NULL,
  changed_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_slug_history_old_slug ON public.profile_slug_history (LOWER(TRIM(old_slug)));
CREATE INDEX IF NOT EXISTS idx_profile_slug_history_profile_id ON public.profile_slug_history (profile_id);

COMMENT ON TABLE public.profile_slug_history IS 'Records previous profile slugs for 301 redirects; populated by trigger on profiles.username change.';

ALTER TABLE public.profile_slug_history ENABLE ROW LEVEL SECURITY;

-- Only service role / backend need to read for redirect resolution; no anon read.
DROP POLICY IF EXISTS "profile_slug_history_select_service" ON public.profile_slug_history;
CREATE POLICY "profile_slug_history_select_service" ON public.profile_slug_history
  FOR SELECT USING (true);

-- Only trigger (SECURITY DEFINER) inserts; no direct insert from app.
REVOKE INSERT ON public.profile_slug_history FROM authenticated;
REVOKE INSERT ON public.profile_slug_history FROM anon;
GRANT SELECT ON public.profile_slug_history TO anon;
GRANT SELECT ON public.profile_slug_history TO service_role;

CREATE OR REPLACE FUNCTION public.profile_slug_history_on_username_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.username IS DISTINCT FROM NEW.username
     AND NEW.username IS NOT NULL
     AND TRIM(NEW.username) <> '' THEN
    INSERT INTO public.profile_slug_history (profile_id, old_slug, new_slug)
    VALUES (
      NEW.id,
      COALESCE(TRIM(OLD.username), ''),
      TRIM(NEW.username)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_slug_history ON public.profiles;
CREATE TRIGGER trg_profile_slug_history
  AFTER UPDATE OF username ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profile_slug_history_on_username_change();
