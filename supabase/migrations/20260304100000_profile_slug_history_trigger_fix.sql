-- Slug history: only record real slug changes (not NULL/empty -> slug).
-- Normalize stored values: lower(btrim(...)); skip case-only changes.
-- Replaces profile_slug_history_on_username_change from 20260304000000.

CREATE OR REPLACE FUNCTION public.profile_slug_history_on_username_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_slug text;
  v_new_slug text;
BEGIN
  v_old_slug := lower(btrim(COALESCE(OLD.username, '')));
  v_new_slug := lower(btrim(COALESCE(NEW.username, '')));

  IF OLD.username IS NOT NULL
     AND btrim(OLD.username) <> ''
     AND NEW.username IS NOT NULL
     AND btrim(NEW.username) <> ''
     AND v_old_slug <> v_new_slug
  THEN
    INSERT INTO public.profile_slug_history (profile_id, old_slug, new_slug)
    VALUES (NEW.id, v_old_slug, v_new_slug);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.profile_slug_history_on_username_change() IS
  'Records only real slug changes: OLD and NEW non-null, non-empty, and different (case-insensitive). Never inserts NULL/empty -> slug.';
