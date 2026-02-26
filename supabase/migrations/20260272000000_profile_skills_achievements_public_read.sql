-- Public read for profile_skills and profile_achievements (is_public = true).
-- Owner keeps full CRUD via existing policies.

CREATE POLICY "profile_skills_select_public"
  ON public.profile_skills FOR SELECT
  USING (is_public = true);

CREATE POLICY "profile_achievements_select_public"
  ON public.profile_achievements FOR SELECT
  USING (is_public = true);
