-- =============================================================================
-- CRM workspace: core tables. Isolated from Linkary app; use crm_ prefix.
-- Apply after all existing Linkary migrations. RLS in separate migration.
-- =============================================================================

-- Workspaces: creator | org | project | brand | agency
CREATE TABLE IF NOT EXISTS public.crm_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('creator', 'org', 'project', 'brand', 'agency')),
  slug text NOT NULL,
  name text NOT NULL,
  owner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  linked_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slug)
);

CREATE INDEX IF NOT EXISTS idx_crm_workspaces_owner ON public.crm_workspaces(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_crm_workspaces_type ON public.crm_workspaces(type);

-- Workspace members and roles
CREATE TABLE IF NOT EXISTS public.crm_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_workspaces(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_workspace_members_workspace ON public.crm_workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_workspace_members_profile ON public.crm_workspace_members(profile_id);

-- Boards: personal, campaign, ops
CREATE TABLE IF NOT EXISTS public.crm_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'personal' CHECK (kind IN ('personal', 'campaign', 'ops')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_boards_workspace ON public.crm_boards(workspace_id);

-- Board columns (status columns for kanban)
CREATE TABLE IF NOT EXISTS public.crm_board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  UNIQUE(board_id, key)
);

CREATE INDEX IF NOT EXISTS idx_crm_board_columns_board ON public.crm_board_columns(board_id);

-- Campaigns (link to Linkary optional)
CREATE TABLE IF NOT EXISTS public.crm_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_workspaces(id) ON DELETE CASCADE,
  source_linkary_campaign_id text,
  title text NOT NULL,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  budget numeric,
  currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
  payout_model text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_campaigns_workspace ON public.crm_campaigns(workspace_id);

-- Task bundles: one per creator per campaign (deliverables set)
CREATE TABLE IF NOT EXISTS public.crm_task_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_workspaces(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  participant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  expected_task_count int NOT NULL DEFAULT 0,
  completed_task_count int NOT NULL DEFAULT 0,
  contribution_percent numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, participant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_task_bundles_campaign ON public.crm_task_bundles(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_task_bundles_participant ON public.crm_task_bundles(participant_profile_id);

-- Tasks
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_workspaces(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.crm_boards(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.crm_campaigns(id) ON DELETE SET NULL,
  task_bundle_id uuid REFERENCES public.crm_task_bundles(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual', 'sprint_auto', 'org_manual', 'system')),
  title text NOT NULL,
  description text,
  platform text,
  status text NOT NULL DEFAULT 'backlog' CHECK (status IN (
    'backlog', 'to_do', 'in_progress', 'submitted', 'approved', 'rejected', 'done'
  )),
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_at timestamptz,
  recurrence_rule text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_workspace ON public.crm_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_board ON public.crm_tasks(board_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_campaign ON public.crm_tasks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON public.crm_tasks(assigned_to);

-- Campaign participants
CREATE TABLE IF NOT EXISTS public.crm_campaign_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  participant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contributor',
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'removed')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  contribution_percent numeric,
  UNIQUE(campaign_id, participant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_campaign_participants_campaign ON public.crm_campaign_participants(campaign_id);

-- Submission requirements (what deliverables a campaign expects)
CREATE TABLE IF NOT EXISTS public.crm_submission_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  task_template_id uuid,
  platform text NOT NULL,
  requirement_type text NOT NULL,
  validation_rules jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_submission_requirements_campaign ON public.crm_submission_requirements(campaign_id);

-- Submissions (proof URLs, review state)
CREATE TABLE IF NOT EXISTS public.crm_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  participant_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  title text,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_revision')),
  reviewer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  rejection_reason text,
  metrics_snapshot jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_submissions_task ON public.crm_submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_crm_submissions_campaign ON public.crm_submissions(campaign_id);

-- Activity log
CREATE TABLE IF NOT EXISTS public.crm_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.crm_workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_activity_log_workspace ON public.crm_activity_log(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_log_entity ON public.crm_activity_log(entity_type, entity_id);

-- Daily metrics snapshot (no live heavy calc on page load)
CREATE TABLE IF NOT EXISTS public.crm_campaign_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  day date NOT NULL,
  total_views bigint DEFAULT 0,
  total_engagements bigint DEFAULT 0,
  total_posts int DEFAULT 0,
  total_contributors int DEFAULT 0,
  conversions bigint,
  spend_used numeric,
  mindshare_score numeric,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, day)
);

CREATE INDEX IF NOT EXISTS idx_crm_campaign_metrics_daily_campaign ON public.crm_campaign_metrics_daily(campaign_id);

-- Report snapshots
CREATE TABLE IF NOT EXISTS public.crm_campaign_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.crm_campaigns(id) ON DELETE CASCADE,
  report_version int NOT NULL DEFAULT 1,
  totals jsonb NOT NULL DEFAULT '{}',
  top_contributors jsonb DEFAULT '[]',
  chart_series jsonb DEFAULT '[]',
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_campaign_reports_campaign ON public.crm_campaign_reports(campaign_id);
