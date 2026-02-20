-- =============================================================================
-- Unify analytics_snapshots: canonical schema owner_type, owner_id, platform, day, window_days, metrics.
-- Migrate from profile_id/snapshot_date; add RLS for SELECT + INSERT/UPDATE by owner.
-- =============================================================================

-- 1) Add new columns if they don't exist
ALTER TABLE public.analytics_snapshots
  ADD COLUMN IF NOT EXISTS owner_type text,
  ADD COLUMN IF NOT EXISTS owner_id uuid,
  ADD COLUMN IF NOT EXISTS day date,
  ADD COLUMN IF NOT EXISTS window_days int DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metrics jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

-- 2) Migrate existing rows (profile_id, snapshot_date -> owner_type, owner_id, day, window_days, metrics)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'profile_id') THEN
    UPDATE public.analytics_snapshots
    SET
      owner_type = 'profile',
      owner_id = profile_id,
      day = snapshot_date,
      window_days = 1,
      metrics = jsonb_build_object(
        'followers_total', followers_total,
        'engagement_rate_proxy', engagement_rate_proxy
      ),
      updated_at = COALESCE(updated_at, created_at, now())
    WHERE owner_type IS NULL;
  END IF;
END $$;

-- 3) Set NOT NULL and defaults where needed
ALTER TABLE public.analytics_snapshots
  ALTER COLUMN owner_type SET DEFAULT 'profile',
  ALTER COLUMN window_days SET DEFAULT 1,
  ALTER COLUMN metrics SET DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'owner_type') THEN
    UPDATE public.analytics_snapshots SET owner_type = 'profile' WHERE owner_type IS NULL;
    ALTER TABLE public.analytics_snapshots ALTER COLUMN owner_type SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'owner_id') THEN
    UPDATE public.analytics_snapshots SET owner_id = profile_id WHERE owner_id IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'profile_id');
    ALTER TABLE public.analytics_snapshots ALTER COLUMN owner_id SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'day') THEN
    UPDATE public.analytics_snapshots SET day = snapshot_date WHERE day IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'snapshot_date');
    ALTER TABLE public.analytics_snapshots ALTER COLUMN day SET NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'metrics') THEN
    UPDATE public.analytics_snapshots SET metrics = COALESCE(metrics, '{}') WHERE metrics IS NULL;
    ALTER TABLE public.analytics_snapshots ALTER COLUMN metrics SET NOT NULL;
  END IF;
END $$;

-- 4) Drop old unique constraint (name may vary)
ALTER TABLE public.analytics_snapshots DROP CONSTRAINT IF EXISTS analytics_snapshots_profile_id_platform_snapshot_date_key;

DO $$
DECLARE
  conname text;
BEGIN
  FOR conname IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'analytics_snapshots' AND c.contype = 'u'
      AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.conrelid AND a.attname = 'profile_id' AND NOT a.attisdropped)
  LOOP
    EXECUTE format('ALTER TABLE public.analytics_snapshots DROP CONSTRAINT IF EXISTS %I', conname);
  END LOOP;
END $$;

-- 5) Create canonical unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_analytics_snapshots_canonical_unique
  ON public.analytics_snapshots (owner_type, owner_id, platform, day, window_days);

-- 6) Drop RLS policies that reference profile_id (must happen before dropping the column)
DROP POLICY IF EXISTS "analytics_snapshots_select_own_or_public" ON public.analytics_snapshots;

-- 7) Drop old columns (and FK) if they exist
ALTER TABLE public.analytics_snapshots DROP CONSTRAINT IF EXISTS analytics_snapshots_profile_id_fkey;
ALTER TABLE public.analytics_snapshots DROP COLUMN IF EXISTS profile_id;
ALTER TABLE public.analytics_snapshots DROP COLUMN IF EXISTS snapshot_date;
ALTER TABLE public.analytics_snapshots DROP COLUMN IF EXISTS followers_total;
ALTER TABLE public.analytics_snapshots DROP COLUMN IF EXISTS engagement_rate_proxy;
ALTER TABLE public.analytics_snapshots DROP COLUMN IF EXISTS created_at;

-- 8) Index for common reads
CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_owner_platform_day
  ON public.analytics_snapshots (owner_type, owner_id, platform, day DESC);

-- 9) RLS: create new policies (old select policy already dropped in step 6)
CREATE POLICY "analytics_snapshots_select_own_or_public" ON public.analytics_snapshots
  FOR SELECT USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'profile' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = analytics_snapshots.owner_id AND p.published = true))
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = analytics_snapshots.owner_id AND m.user_id = auth.uid()))
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.orgs o WHERE o.id = analytics_snapshots.owner_id))
  );

CREATE POLICY "analytics_snapshots_insert_own" ON public.analytics_snapshots
  FOR INSERT WITH CHECK (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = analytics_snapshots.owner_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))
  );

CREATE POLICY "analytics_snapshots_update_own" ON public.analytics_snapshots
  FOR UPDATE USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = analytics_snapshots.owner_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')))
  );

COMMENT ON TABLE public.analytics_snapshots IS 'Canonical analytics: owner_type, owner_id, platform, day, window_days (1=daily), metrics JSONB. Idempotent upsert on (owner_type, owner_id, platform, day, window_days).';
