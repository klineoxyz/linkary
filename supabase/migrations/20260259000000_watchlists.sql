-- Watchlist: save profiles or orgs for quick access. Owner-only RLS.
CREATE TABLE IF NOT EXISTS public.watchlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('profile', 'org')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_profile_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_watchlists_owner ON public.watchlists (owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_entity ON public.watchlists (entity_type, entity_id);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlists_select_owner" ON public.watchlists;
CREATE POLICY "watchlists_select_owner" ON public.watchlists
  FOR SELECT USING (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS "watchlists_insert_owner" ON public.watchlists;
CREATE POLICY "watchlists_insert_owner" ON public.watchlists
  FOR INSERT WITH CHECK (owner_profile_id = auth.uid());

DROP POLICY IF EXISTS "watchlists_delete_owner" ON public.watchlists;
CREATE POLICY "watchlists_delete_owner" ON public.watchlists
  FOR DELETE USING (owner_profile_id = auth.uid());

COMMENT ON TABLE public.watchlists IS 'Saved profiles/orgs per user (watchlist). RLS: only owner can read/write.';
