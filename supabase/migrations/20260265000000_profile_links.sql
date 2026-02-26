-- profile_links: Linktree-style links for public profile (linkary.xyz/username)
BEGIN;

CREATE TABLE IF NOT EXISTS public.profile_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  icon text,
  is_public boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profile_links_profile_id_sort
  ON public.profile_links (profile_id, sort_order);

COMMENT ON TABLE public.profile_links IS 'Profile links (Linktree blocks). Only owner can CRUD; public page shows is_public=true ordered by sort_order.';

ALTER TABLE public.profile_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_links_all_own"
  ON public.profile_links
  FOR ALL
  USING (profile_id = auth.uid());

COMMIT;
