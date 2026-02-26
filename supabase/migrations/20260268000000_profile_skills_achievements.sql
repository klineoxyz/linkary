-- profile_skills: Individual profile skills (name, optional level 1..5)
BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  level int NULL CHECK (level >= 1 AND level <= 5),
  sort_order int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_skills_profile_id_sort
  ON public.profile_skills (profile_id, sort_order);

COMMENT ON TABLE public.profile_skills IS 'Individual profile skills. Owner-only CRUD; public page shows is_public=true.';

ALTER TABLE public.profile_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_skills_all_own"
  ON public.profile_skills
  FOR ALL
  USING (profile_id = auth.uid());

COMMIT;

-- profile_achievements: Individual profile achievements
BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NULL,
  year int NULL,
  proof_url text NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_achievements_profile_id_sort
  ON public.profile_achievements (profile_id, sort_order);

COMMENT ON TABLE public.profile_achievements IS 'Individual profile achievements. Owner-only CRUD; public page shows is_public=true.';

ALTER TABLE public.profile_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_achievements_all_own"
  ON public.profile_achievements
  FOR ALL
  USING (profile_id = auth.uid());

COMMIT;
