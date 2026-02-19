-- =============================================================================
-- Linkary: Professions (flexible roles for onboarding and profile)
-- Single namespace; slug unique; profile_professions = many-to-many.
-- =============================================================================

-- =============================================================================
-- 1) professions
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.professions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(slug)
);

CREATE INDEX IF NOT EXISTS idx_professions_slug ON public.professions (slug);
CREATE INDEX IF NOT EXISTS idx_professions_name_lower ON public.professions (LOWER(name));

COMMENT ON TABLE public.professions IS 'Global profession list; slug is normalized (lowercase, hyphenated) for dedup.';

-- =============================================================================
-- 2) profile_professions (join)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profile_professions (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profession_id uuid NOT NULL REFERENCES public.professions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id, profession_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_professions_profile ON public.profile_professions (profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_professions_profession ON public.profile_professions (profession_id);

-- =============================================================================
-- 3) Normalize name to slug (lowercase, trim, spaces -> hyphen, remove non-alphanumeric except hyphen)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.normalize_profession_slug(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    regexp_replace(
      lower(trim(coalesce(p_name, ''))),
      '[^a-z0-9\s\-]', '', 'g'
    ),
    '\s+', '-', 'g'
  );
$$;

-- =============================================================================
-- 4) upsert_profession(p_name text) returns uuid
-- =============================================================================
CREATE OR REPLACE FUNCTION public.upsert_profession(p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug text;
  v_id uuid;
BEGIN
  v_slug := public.normalize_profession_slug(p_name);
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Invalid profession name';
  END IF;

  INSERT INTO public.professions (name, slug, created_by)
  VALUES (trim(p_name), v_slug, auth.uid())
  ON CONFLICT (slug) DO UPDATE SET name = trim(p_name)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.upsert_profession(text) IS 'Create or get profession by name; slug is unique (case-insensitive). Returns profession id.';

GRANT EXECUTE ON FUNCTION public.upsert_profession(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_profession(text) TO service_role;

-- =============================================================================
-- 5) RLS
-- =============================================================================
ALTER TABLE public.professions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "professions_select_public" ON public.professions;
CREATE POLICY "professions_select_public" ON public.professions FOR SELECT USING (true);

DROP POLICY IF EXISTS "professions_insert_authenticated" ON public.professions;
CREATE POLICY "professions_insert_authenticated" ON public.professions
  FOR INSERT TO authenticated WITH CHECK (true);

ALTER TABLE public.profile_professions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_professions_select_own" ON public.profile_professions;
CREATE POLICY "profile_professions_select_own" ON public.profile_professions
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_professions_insert_own" ON public.profile_professions;
CREATE POLICY "profile_professions_insert_own" ON public.profile_professions
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_professions_delete_own" ON public.profile_professions;
CREATE POLICY "profile_professions_delete_own" ON public.profile_professions
  FOR DELETE USING (profile_id = auth.uid());

-- =============================================================================
-- 6) Seed default professions
-- =============================================================================
INSERT INTO public.professions (name, slug, created_by)
VALUES
  ('Founder', 'founder', NULL),
  ('Creator', 'creator', NULL),
  ('Angel Investor', 'angel-investor', NULL),
  ('Investor', 'investor', NULL),
  ('CMO', 'cmo', NULL),
  ('CTO', 'cto', NULL),
  ('Developer', 'developer', NULL),
  ('Designer', 'designer', NULL),
  ('Community Manager', 'community-manager', NULL),
  ('BD', 'bd', NULL),
  ('Product Manager', 'product-manager', NULL),
  ('Analyst', 'analyst', NULL),
  ('Growth', 'growth', NULL),
  ('KOL', 'kol', NULL),
  ('Advisor', 'advisor', NULL)
ON CONFLICT (slug) DO NOTHING;
