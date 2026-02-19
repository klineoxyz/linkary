-- =============================================================================
-- Public one-pager: profile_socials, media, analytics_snapshots, ecosystem,
-- crypto token fields, ethos cache, subscriptions, public views.
-- =============================================================================

-- 1) profile_socials
CREATE TABLE IF NOT EXISTS public.profile_socials (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  x_url text,
  linkedin_url text,
  youtube_url text,
  website_url text,
  telegram_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_socials_profile_id ON public.profile_socials (profile_id);
ALTER TABLE public.profile_socials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_socials_select_public_or_own" ON public.profile_socials;
CREATE POLICY "profile_socials_select_public_or_own" ON public.profile_socials
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_socials.profile_id AND p.published = true)
  );
CREATE POLICY "profile_socials_all_own" ON public.profile_socials FOR ALL USING (profile_id = auth.uid());

-- 2) profile_media (header for home + optional public hero)
CREATE TABLE IF NOT EXISTS public.profile_media (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  header_media_type text NOT NULL DEFAULT 'NONE' CHECK (header_media_type IN ('NONE', 'IMAGE', 'VIDEO')),
  header_media_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (profile_id)
);

ALTER TABLE public.profile_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_media_select_public_or_own" ON public.profile_media FOR SELECT USING (
  profile_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_media.profile_id AND p.published = true)
);
CREATE POLICY "profile_media_all_own" ON public.profile_media FOR ALL USING (profile_id = auth.uid());

-- 3) org_media
CREATE TABLE IF NOT EXISTS public.org_media (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  header_media_type text NOT NULL DEFAULT 'NONE' CHECK (header_media_type IN ('NONE', 'IMAGE', 'VIDEO')),
  header_media_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (org_id)
);

ALTER TABLE public.org_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_media_select_public" ON public.org_media FOR SELECT USING (true);
CREATE POLICY "org_media_all_member" ON public.org_media FOR ALL USING (
  EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_media.org_id AND m.user_id = auth.uid())
);

-- 4) analytics_snapshots (if not exists; x-sync may have created with profile_id)
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  platform text NOT NULL DEFAULT 'x',
  window_days int NOT NULL DEFAULT 30,
  followers bigint,
  reach_avg numeric,
  engagement_rate numeric,
  likes_avg numeric,
  replies_avg numeric,
  spaces_count int,
  followers_delta bigint,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- If table already exists from x-sync (has profile_id, no owner_type), add columns and backfill
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'profile_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'owner_type'
  ) THEN
    ALTER TABLE public.analytics_snapshots
      ADD COLUMN IF NOT EXISTS owner_type text,
      ADD COLUMN IF NOT EXISTS owner_id uuid,
      ADD COLUMN IF NOT EXISTS window_days int DEFAULT 30;
    UPDATE public.analytics_snapshots
    SET owner_type = 'profile', owner_id = profile_id, window_days = 30
    WHERE owner_type IS NULL;
    ALTER TABLE public.analytics_snapshots
      ALTER COLUMN owner_type SET NOT NULL,
      ALTER COLUMN owner_id SET NOT NULL;
    ALTER TABLE public.analytics_snapshots
      ALTER COLUMN owner_type SET DEFAULT 'profile';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_owner ON public.analytics_snapshots (owner_type, owner_id, platform, window_days);

-- 5) org_relationships (subsidiaries, ecosystem, brands)
CREATE TABLE IF NOT EXISTS public.org_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  child_org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  rel_type text NOT NULL CHECK (rel_type IN ('SUBSIDIARY', 'ECOSYSTEM', 'BRAND')),
  since_date date,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(parent_org_id, child_org_id, rel_type)
);

CREATE INDEX IF NOT EXISTS idx_org_relationships_parent ON public.org_relationships (parent_org_id);
CREATE INDEX IF NOT EXISTS idx_org_relationships_child ON public.org_relationships (child_org_id);

-- 6) org_ecosystem_categories (many per org)
CREATE TABLE IF NOT EXISTS public.org_ecosystem_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  category text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(org_id, category)
);

CREATE INDEX IF NOT EXISTS idx_org_ecosystem_categories_org ON public.org_ecosystem_categories (org_id);

-- 7) orgs: crypto token fields + xscore 0-1000
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS is_crypto_project boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_token boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS token_symbol text,
  ADD COLUMN IF NOT EXISTS dexscreener_url text,
  ADD COLUMN IF NOT EXISTS xscore int;

-- 8) profiles: xscore 0-1000 (store from Wallchain)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xscore int;

-- 9) ethos_scores cache (API writes with service role)
CREATE TABLE IF NOT EXISTS public.ethos_scores (
  userkey text PRIMARY KEY,
  score_json jsonb,
  score_value numeric,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- 10) subscriptions (tier for monetization locks)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  tier text NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'host', 'brand', 'venture')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(owner_type, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON public.subscriptions (owner_type, owner_id);

-- 11) Public views (safe fields only)
CREATE OR REPLACE VIEW public.public_profile_view AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.avatar_url,
  p.website,
  p.twitter_username,
  p.location,
  p.published,
  p.followers_total,
  p.avg_engagement_rate,
  p.xscore,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.published = true AND p.username IS NOT NULL AND p.username <> '';

CREATE OR REPLACE VIEW public.public_org_view AS
SELECT
  o.id,
  o.slug,
  o.name,
  o.tagline,
  o.website,
  o.twitter_username,
  o.logo_url,
  o.org_type,
  o.parent_org_id,
  o.is_crypto_project,
  o.has_token,
  o.token_symbol,
  o.dexscreener_url,
  o.created_at,
  o.updated_at
FROM public.orgs o;

-- RLS on views: use underlying table RLS. Or grant SELECT to anon on views.
GRANT SELECT ON public.public_profile_view TO anon;
GRANT SELECT ON public.public_org_view TO anon;
