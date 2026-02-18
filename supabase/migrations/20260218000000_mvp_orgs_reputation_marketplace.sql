-- =============================================================================
-- Linkary MVP: Orgs, hierarchy, affiliates, ambassadors, influence, marketplace
-- Run after base tables (profiles, wallets) exist.
-- =============================================================================

-- =============================================================================
-- 1) ALTER profiles
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS intents jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS followers_total bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_engagement_rate numeric DEFAULT 0;

COMMENT ON COLUMN public.profiles.avg_engagement_rate IS '0-1 or 0-100; be consistent app-wide';

-- Update RLS: public SELECT only if published OR own row (replaces previous public SELECT)
DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (published = true OR auth.uid() = id);

-- =============================================================================
-- 2) CREATE TABLE orgs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  name text NOT NULL,
  tagline text,
  website text,
  twitter_username text,
  logo_url text,
  org_type text NOT NULL CHECK (org_type IN ('company','brand','project','agency')),
  parent_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orgs_slug_lower ON public.orgs (LOWER(slug));
CREATE INDEX IF NOT EXISTS idx_orgs_parent_org_id ON public.orgs (parent_org_id);
CREATE INDEX IF NOT EXISTS idx_orgs_org_type ON public.orgs (org_type);

-- =============================================================================
-- 3) CREATE TABLE org_members
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON public.org_members (org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON public.org_members (user_id);

-- =============================================================================
-- 4) CREATE TABLE org_affiliations (affiliate: max 1 org per profile)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('invited','active','removed')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_affiliations_org_id ON public.org_affiliations (org_id);
CREATE INDEX IF NOT EXISTS idx_org_affiliations_profile_id ON public.org_affiliations (profile_id);

-- =============================================================================
-- 5) CREATE TABLE org_ambassadors (max 10 orgs per profile via trigger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_ambassadors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('invited','active','removed')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(org_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_ambassadors_org_id ON public.org_ambassadors (org_id);
CREATE INDEX IF NOT EXISTS idx_org_ambassadors_profile_id ON public.org_ambassadors (profile_id);

-- Trigger: max 10 active/invited ambassadors per profile
CREATE OR REPLACE FUNCTION public.check_org_ambassadors_max_per_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  SELECT count(*)::integer INTO cnt
  FROM public.org_ambassadors
  WHERE profile_id = NEW.profile_id
    AND status IN ('invited', 'active');
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'A profile may be ambassador for at most 10 orgs.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_ambassadors_max_per_profile ON public.org_ambassadors;
CREATE TRIGGER trg_org_ambassadors_max_per_profile
  BEFORE INSERT ON public.org_ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.check_org_ambassadors_max_per_profile();

-- On UPDATE, if status changes to invited/active, we must re-check count (excluding current row)
CREATE OR REPLACE FUNCTION public.check_org_ambassadors_max_per_profile_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt integer;
BEGIN
  IF NEW.status IN ('invited', 'active') AND (OLD.status IS NULL OR OLD.status NOT IN ('invited', 'active')) THEN
    SELECT count(*)::integer INTO cnt
    FROM public.org_ambassadors
    WHERE profile_id = NEW.profile_id
      AND status IN ('invited', 'active')
      AND id <> NEW.id;
    IF cnt >= 10 THEN
      RAISE EXCEPTION 'A profile may be ambassador for at most 10 orgs.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_org_ambassadors_max_per_profile_update ON public.org_ambassadors;
CREATE TRIGGER trg_org_ambassadors_max_per_profile_update
  BEFORE UPDATE ON public.org_ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.check_org_ambassadors_max_per_profile_on_update();

-- =============================================================================
-- 6) CREATE TABLE org_metrics (cached influence)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.org_metrics (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  combined_followers bigint DEFAULT 0,
  avg_engagement_rate numeric DEFAULT 0,
  potential_reach bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_metrics_org_id ON public.org_metrics (org_id);

-- =============================================================================
-- 7) CREATE TABLE case_studies (polymorphic: profile or org)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.case_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile','org')),
  owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text,
  description text,
  proof_url text,
  metrics jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT case_studies_owner_check CHECK (
    (owner_type = 'profile' AND owner_profile_id IS NOT NULL AND owner_org_id IS NULL)
    OR (owner_type = 'org' AND owner_org_id IS NOT NULL AND owner_profile_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_case_studies_owner_profile ON public.case_studies (owner_profile_id) WHERE owner_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_studies_owner_org ON public.case_studies (owner_org_id) WHERE owner_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_case_studies_owner_type ON public.case_studies (owner_type);

-- =============================================================================
-- 8) CREATE jobs
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('job','sprint')),
  title text NOT NULL,
  budget text,
  duration text,
  tags jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','accepted','completed','paid')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_org_id ON public.jobs (org_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs (status);

-- =============================================================================
-- 9) CREATE applications (individual OR org applicant)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  applicant_type text NOT NULL CHECK (applicant_type IN ('profile','org')),
  applicant_profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  applicant_org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','withdrawn')),
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT applications_applicant_check CHECK (
    (applicant_type = 'profile' AND applicant_profile_id IS NOT NULL AND applicant_org_id IS NULL)
    OR (applicant_type = 'org' AND applicant_org_id IS NOT NULL AND applicant_profile_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications (job_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_profile ON public.applications (applicant_profile_id) WHERE applicant_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_applicant_org ON public.applications (applicant_org_id) WHERE applicant_org_id IS NOT NULL;

-- =============================================================================
-- 10) CREATE conversations (participants as jsonb: [{type, id}, ...])
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participants jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON COLUMN public.conversations.participants IS 'Array of {type: "profile"|"org", id: uuid}';

-- =============================================================================
-- 11) CREATE messages (sender can be profile or org)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('profile','org')),
  sender_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT messages_sender_check CHECK (
    (sender_type = 'profile' AND sender_profile_id IS NOT NULL AND sender_org_id IS NULL)
    OR (sender_type = 'org' AND sender_org_id IS NOT NULL AND sender_profile_id IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id);

-- =============================================================================
-- 12) CREATE deals
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','disputed')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deals_profile_id ON public.deals (profile_id);
CREATE INDEX IF NOT EXISTS idx_deals_org_id ON public.deals (org_id);
CREATE INDEX IF NOT EXISTS idx_deals_job_id ON public.deals (job_id);

-- =============================================================================
-- 13) CREATE reviews (reviewer and reviewee can be profile or org)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_type text NOT NULL CHECK (reviewer_type IN ('profile','org')),
  reviewer_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewer_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  reviewee_type text NOT NULL CHECK (reviewee_type IN ('profile','org')),
  reviewee_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewee_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  body text,
  would_work_again boolean,
  verified_deal boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT reviews_reviewer_check CHECK (
    (reviewer_type = 'profile' AND reviewer_profile_id IS NOT NULL AND reviewer_org_id IS NULL)
    OR (reviewer_type = 'org' AND reviewer_org_id IS NOT NULL AND reviewer_profile_id IS NULL)
  ),
  CONSTRAINT reviews_reviewee_check CHECK (
    (reviewee_type = 'profile' AND reviewee_profile_id IS NOT NULL AND reviewee_org_id IS NULL)
    OR (reviewee_type = 'org' AND reviewee_org_id IS NOT NULL AND reviewee_profile_id IS NULL)
  )
);

-- Indexes on reviews: only create if columns exist (reviews may already exist with different schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'reviewee_profile_id') THEN
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_profile ON public.reviews (reviewee_profile_id) WHERE reviewee_profile_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'reviewee_org_id') THEN
    CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_org ON public.reviews (reviewee_org_id) WHERE reviewee_org_id IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'deal_id') THEN
    CREATE INDEX IF NOT EXISTS idx_reviews_deal_id ON public.reviews (deal_id);
  END IF;
END $$;

-- =============================================================================
-- 14) RLS: orgs
-- =============================================================================
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orgs_select_public" ON public.orgs;
CREATE POLICY "orgs_select_public" ON public.orgs FOR SELECT USING (true);

DROP POLICY IF EXISTS "orgs_insert_authed" ON public.orgs;
CREATE POLICY "orgs_insert_authed" ON public.orgs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "orgs_update_owner_admin" ON public.orgs;
CREATE POLICY "orgs_update_owner_admin" ON public.orgs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = orgs.id AND m.user_id = auth.uid() AND m.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 15) RLS: org_members
-- =============================================================================
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select_members" ON public.org_members;
CREATE POLICY "org_members_select_members" ON public.org_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.org_members m2 WHERE m2.org_id = org_members.org_id AND m2.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "org_members_insert_owner" ON public.org_members;
CREATE POLICY "org_members_insert_owner" ON public.org_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_members.org_id AND m.user_id = auth.uid() AND m.role = 'owner')
  );

DROP POLICY IF EXISTS "org_members_update_owner" ON public.org_members;
CREATE POLICY "org_members_update_owner" ON public.org_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_members.org_id AND m.user_id = auth.uid() AND m.role = 'owner')
  );

DROP POLICY IF EXISTS "org_members_delete_owner" ON public.org_members;
CREATE POLICY "org_members_delete_owner" ON public.org_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_members.org_id AND m.user_id = auth.uid() AND m.role = 'owner')
  );

-- =============================================================================
-- 16) RLS: org_affiliations
-- =============================================================================
ALTER TABLE public.org_affiliations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_affiliations_select_active_public" ON public.org_affiliations;
CREATE POLICY "org_affiliations_select_active_public" ON public.org_affiliations
  FOR SELECT USING (status = 'active' OR profile_id IN (SELECT id FROM public.profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_affiliations.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));

DROP POLICY IF EXISTS "org_affiliations_insert_org_admin" ON public.org_affiliations;
CREATE POLICY "org_affiliations_insert_org_admin" ON public.org_affiliations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_affiliations.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "org_affiliations_update_org_or_profile" ON public.org_affiliations;
CREATE POLICY "org_affiliations_update_org_or_profile" ON public.org_affiliations
  FOR UPDATE USING (
    profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_affiliations.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

-- =============================================================================
-- 17) RLS: org_ambassadors
-- =============================================================================
ALTER TABLE public.org_ambassadors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_ambassadors_select_active_public" ON public.org_ambassadors;
CREATE POLICY "org_ambassadors_select_active_public" ON public.org_ambassadors
  FOR SELECT USING (status IN ('active','invited') OR profile_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_ambassadors.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')));

DROP POLICY IF EXISTS "org_ambassadors_insert_org_admin" ON public.org_ambassadors;
CREATE POLICY "org_ambassadors_insert_org_admin" ON public.org_ambassadors
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_ambassadors.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "org_ambassadors_update_org_or_profile" ON public.org_ambassadors;
CREATE POLICY "org_ambassadors_update_org_or_profile" ON public.org_ambassadors
  FOR UPDATE USING (
    profile_id = auth.uid() OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_ambassadors.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

-- =============================================================================
-- 18) RLS: org_metrics
-- =============================================================================
ALTER TABLE public.org_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_metrics_select_public" ON public.org_metrics;
CREATE POLICY "org_metrics_select_public" ON public.org_metrics FOR SELECT USING (true);

DROP POLICY IF EXISTS "org_metrics_update_org_admin" ON public.org_metrics;
CREATE POLICY "org_metrics_update_org_admin" ON public.org_metrics
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_metrics.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "org_metrics_insert_org_admin" ON public.org_metrics;
CREATE POLICY "org_metrics_insert_org_admin" ON public.org_metrics
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = org_metrics.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

-- =============================================================================
-- 19) RLS: case_studies
-- =============================================================================
ALTER TABLE public.case_studies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "case_studies_select_public" ON public.case_studies;
CREATE POLICY "case_studies_select_public" ON public.case_studies FOR SELECT USING (true);

DROP POLICY IF EXISTS "case_studies_insert_owner" ON public.case_studies;
CREATE POLICY "case_studies_insert_owner" ON public.case_studies
  FOR INSERT WITH CHECK (
    (owner_type = 'profile' AND owner_profile_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = case_studies.owner_org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  );

DROP POLICY IF EXISTS "case_studies_update_owner" ON public.case_studies;
CREATE POLICY "case_studies_update_owner" ON public.case_studies
  FOR UPDATE USING (
    (owner_type = 'profile' AND owner_profile_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = case_studies.owner_org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  );

DROP POLICY IF EXISTS "case_studies_delete_owner" ON public.case_studies;
CREATE POLICY "case_studies_delete_owner" ON public.case_studies
  FOR DELETE USING (
    (owner_type = 'profile' AND owner_profile_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = case_studies.owner_org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  );

-- =============================================================================
-- 20) RLS: jobs
-- =============================================================================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select_public" ON public.jobs;
CREATE POLICY "jobs_select_public" ON public.jobs FOR SELECT USING (true);

DROP POLICY IF EXISTS "jobs_insert_org_admin" ON public.jobs;
CREATE POLICY "jobs_insert_org_admin" ON public.jobs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = jobs.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "jobs_update_org_admin" ON public.jobs;
CREATE POLICY "jobs_update_org_admin" ON public.jobs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = jobs.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

-- =============================================================================
-- 21) RLS: applications
-- =============================================================================
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select_public" ON public.applications;
CREATE POLICY "applications_select_public" ON public.applications FOR SELECT USING (true);

DROP POLICY IF EXISTS "applications_insert_applicant" ON public.applications;
CREATE POLICY "applications_insert_applicant" ON public.applications
  FOR INSERT WITH CHECK (
    (applicant_type = 'profile' AND applicant_profile_id = auth.uid())
    OR (applicant_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = applications.applicant_org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  );

DROP POLICY IF EXISTS "applications_update_org_admin" ON public.applications;
CREATE POLICY "applications_update_org_admin" ON public.applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      JOIN public.org_members m ON m.org_id = j.org_id
      WHERE j.id = applications.job_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
    )
  );

-- =============================================================================
-- 22) RLS: conversations
-- =============================================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conversations_select_participant" ON public.conversations;
CREATE POLICY "conversations_select_participant" ON public.conversations
  FOR SELECT USING (
    participants @> jsonb_build_array(jsonb_build_object('type', 'profile', 'id', auth.uid()))
    OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = auth.uid() AND participants @> jsonb_build_array(jsonb_build_object('type', 'org', 'id', m.org_id)))
  );

DROP POLICY IF EXISTS "conversations_insert_authed" ON public.conversations;
CREATE POLICY "conversations_insert_authed" ON public.conversations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =============================================================================
-- 23) RLS: messages
-- =============================================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_conversation" ON public.messages;
CREATE POLICY "messages_select_conversation" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participants @> jsonb_build_array(jsonb_build_object('type', 'profile', 'id', auth.uid()))
             OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = auth.uid() AND c.participants @> jsonb_build_array(jsonb_build_object('type', 'org', 'id', m.org_id))))
    )
  );

DROP POLICY IF EXISTS "messages_insert_sender" ON public.messages;
CREATE POLICY "messages_insert_sender" ON public.messages
  FOR INSERT WITH CHECK (
    (sender_type = 'profile' AND sender_profile_id = auth.uid())
    OR (sender_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = messages.sender_org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
  );

-- =============================================================================
-- 24) RLS: deals
-- =============================================================================
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deals_select_party" ON public.deals;
CREATE POLICY "deals_select_party" ON public.deals
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = deals.org_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "deals_insert_org_admin" ON public.deals;
CREATE POLICY "deals_insert_org_admin" ON public.deals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = deals.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

DROP POLICY IF EXISTS "deals_update_org_admin" ON public.deals;
CREATE POLICY "deals_update_org_admin" ON public.deals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = deals.org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  );

-- =============================================================================
-- 25) RLS: reviews (only if table has new schema with reviewer_type column)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'reviews' AND column_name = 'reviewer_type') THEN
    ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "reviews_select_public" ON public.reviews;
    CREATE POLICY "reviews_select_public" ON public.reviews FOR SELECT USING (true);
    DROP POLICY IF EXISTS "reviews_insert_reviewer" ON public.reviews;
    CREATE POLICY "reviews_insert_reviewer" ON public.reviews
      FOR INSERT WITH CHECK (
        (reviewer_type = 'profile' AND reviewer_profile_id = auth.uid())
        OR (reviewer_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = reviews.reviewer_org_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')))
      );
  END IF;
END $$;
