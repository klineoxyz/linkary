import type { SupabaseClient } from "@supabase/supabase-js";
import { planKeyFromSubscriptionRow, type PlanKey, type SubscriptionPlanInput } from "@/lib/planKey";

export type OpsOverviewStats = {
  profilesCount: number | null;
  campaignsCount: number | null;
  activeOpsMembersCount: number | null;
  subscriptionRows: Array<{ plan_key: string | null; tier: string; count: number }>;
};

export async function fetchOpsOverviewStats(service: SupabaseClient): Promise<OpsOverviewStats> {
  const [{ count: profilesCount }, { count: campaignsCount }, { count: activeOpsMembersCount }, subsRes] =
    await Promise.all([
      service.from("profiles").select("*", { count: "exact", head: true }),
      service.from("crm_campaigns").select("*", { count: "exact", head: true }),
      service.from("internal_ops_members").select("*", { count: "exact", head: true }).is("revoked_at", null),
      service
        .from("subscriptions")
        .select("plan_key, tier, owner_type")
        .eq("owner_type", "profile")
        .eq("status", "active"),
    ]);

  const byKey = new Map<string, { plan_key: string | null; tier: string; count: number }>();
  for (const row of subsRes.data ?? []) {
    const plan_key = (row as { plan_key?: string | null }).plan_key ?? null;
    const tier = String((row as { tier?: string }).tier ?? "");
    const mapKey = `${plan_key ?? "∅"}|||${tier}`;
    const cur = byKey.get(mapKey);
    if (cur) cur.count += 1;
    else byKey.set(mapKey, { plan_key, tier, count: 1 });
  }
  const subscriptionRows = [...byKey.values()].sort((a, b) => b.count - a.count);

  return {
    profilesCount,
    campaignsCount,
    activeOpsMembersCount,
    subscriptionRows,
  };
}

export type OpsUserRow = {
  profile_id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
  plan_key: string | null;
  tier: string | null;
  subscription_status: string | null;
};

export async function fetchOpsUserRows(service: SupabaseClient, limit = 100): Promise<OpsUserRow[]> {
  const { data: profiles } = await service
    .from("profiles")
    .select("id, username, display_name, email")
    .order("created_at", { ascending: false })
    .limit(limit);

  const list = (profiles ?? []) as Array<{
    id: string;
    username: string | null;
    display_name: string | null;
    email?: string | null;
  }>;
  if (list.length === 0) return [];

  const ids = list.map((p) => p.id);
  const { data: subs } = await service
    .from("subscriptions")
    .select("owner_id, plan_key, tier, status")
    .eq("owner_type", "profile")
    .in("owner_id", ids);

  const subByProfile = new Map<string, { plan_key: string | null; tier: string | null; status: string | null }>();
  for (const s of subs ?? []) {
    const r = s as { owner_id: string; plan_key?: string | null; tier?: string | null; status?: string | null };
    subByProfile.set(r.owner_id, {
      plan_key: r.plan_key ?? null,
      tier: r.tier ?? null,
      status: r.status ?? null,
    });
  }

  return list.map((p) => {
    const s = subByProfile.get(p.id);
    return {
      profile_id: p.id,
      username: p.username,
      display_name: p.display_name,
      email: (p.email ?? null) as string | null,
      plan_key: s?.plan_key ?? null,
      tier: s?.tier ?? null,
      subscription_status: s?.status ?? null,
    };
  });
}

export type OpsCampaignRow = {
  id: string;
  title: string;
  status: string;
  workspace_id: string;
  workspace_name: string | null;
  workspace_slug: string | null;
  workspace_type: string | null;
  linked_org_id: string | null;
  org_plan_key: PlanKey;
  follow_rules: unknown;
  created_at: string;
};

export async function fetchOpsCampaignRows(service: SupabaseClient, limit = 100): Promise<OpsCampaignRow[]> {
  const { data, error } = await service
    .from("crm_campaigns")
    .select("id, title, status, workspace_id, follow_rules, created_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const parsed = data as Array<{
    id: string;
    title: string;
    status: string;
    workspace_id: string;
    follow_rules: unknown;
    created_at: string;
  }>;

  const wsIds = [...new Set(parsed.map((r) => r.workspace_id))];
  const { data: wsRows } = await service
    .from("crm_workspaces")
    .select("id, name, slug, type, linked_org_id")
    .in("id", wsIds);

  const wsMap = new Map<
    string,
    { name: string; slug: string; type: string; linked_org_id: string | null }
  >();
  for (const w of wsRows ?? []) {
    const row = w as {
      id: string;
      name: string;
      slug: string;
      type: string;
      linked_org_id: string | null;
    };
    wsMap.set(row.id, row);
  }

  const orgIds = [...new Set([...wsMap.values()].map((w) => w.linked_org_id).filter(Boolean))] as string[];
  const orgPlanById = new Map<string, PlanKey>();
  if (orgIds.length > 0) {
    const { data: orgSubs } = await service
      .from("subscriptions")
      .select("owner_id, plan_key, tier, status, current_period_end")
      .eq("owner_type", "org")
      .in("owner_id", orgIds);
    for (const row of orgSubs ?? []) {
      const oid = String((row as { owner_id: string }).owner_id);
      orgPlanById.set(
        oid,
        planKeyFromSubscriptionRow(row as SubscriptionPlanInput)
      );
    }
  }

  return parsed.map((raw) => {
    const ws = wsMap.get(raw.workspace_id);
    const linkedOrgId = ws?.linked_org_id ?? null;
    const org_plan_key = linkedOrgId ? orgPlanById.get(linkedOrgId) ?? "free" : "free";
    return {
      id: raw.id,
      title: raw.title,
      status: raw.status,
      workspace_id: raw.workspace_id,
      workspace_name: ws?.name ?? null,
      workspace_slug: ws?.slug ?? null,
      workspace_type: ws?.type ?? null,
      linked_org_id: linkedOrgId,
      org_plan_key,
      follow_rules: raw.follow_rules,
      created_at: raw.created_at,
    };
  });
}

export type OpsAuditRow = {
  id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  payload_json: unknown;
  reason: string | null;
  created_at: string;
};

export type OpsParticipantRow = {
  id: string;
  campaign_id: string;
  campaign_title: string | null;
  participant_profile_id: string;
  status: string;
  x_follow_attestation: unknown;
  x_follow_verification: unknown;
  invited_at: string;
};

export async function fetchOpsParticipantRows(service: SupabaseClient, limit = 80): Promise<OpsParticipantRow[]> {
  const { data: parts } = await service
    .from("crm_campaign_participants")
    .select("id, campaign_id, participant_profile_id, status, x_follow_attestation, x_follow_verification, invited_at")
    .order("invited_at", { ascending: false })
    .limit(limit);

  const list = (parts ?? []) as Array<{
    id: string;
    campaign_id: string;
    participant_profile_id: string;
    status: string;
    x_follow_attestation: unknown;
    x_follow_verification: unknown;
    invited_at: string;
  }>;
  if (list.length === 0) return [];

  const campIds = [...new Set(list.map((p) => p.campaign_id))];
  const { data: camps } = await service.from("crm_campaigns").select("id, title").in("id", campIds);
  const titleById = new Map<string, string>();
  for (const c of camps ?? []) {
    const row = c as { id: string; title: string };
    titleById.set(row.id, row.title);
  }

  return list.map((p) => ({
    id: p.id,
    campaign_id: p.campaign_id,
    campaign_title: titleById.get(p.campaign_id) ?? null,
    participant_profile_id: p.participant_profile_id,
    status: p.status,
    x_follow_attestation: p.x_follow_attestation,
    x_follow_verification: p.x_follow_verification,
    invited_at: p.invited_at,
  }));
}

export type OpsAuditFilter = "all" | "entitlement" | "usage";

export async function fetchOpsAuditRows(
  service: SupabaseClient,
  limit = 100,
  filter: OpsAuditFilter = "all"
): Promise<OpsAuditRow[]> {
  let q = service
    .from("platform_audit_log")
    .select("id, actor_user_id, action, target_type, target_id, payload_json, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter === "entitlement") {
    q = q.like("action", "ops.entitlement.%");
  } else if (filter === "usage") {
    q = q.eq("action", "ops.usage_counter.reset");
  }

  const { data } = await q;
  return (data ?? []) as OpsAuditRow[];
}

/** Confidence for admin labels — never imply Stripe/settled revenue when only DB counts exist. */
export type OpsMetricConfidence = "exact" | "proxy" | "not_available";

export type OpsFinancialReport = {
  generatedAt: string;
  counts: {
    profilesTotal: { value: number | null; confidence: "exact" };
    orgsTotal: { value: number | null; confidence: "exact" };
    crmWorkspacesTotal: { value: number | null; confidence: "exact" };
    crmCampaignsTotal: { value: number | null; confidence: "exact" };
    crmCampaignsActive: { value: number | null; confidence: "exact" };
    /** Rows in crm_campaign_participants (same creator may appear multiple times). */
    campaignParticipantRows: { value: number | null; confidence: "exact" };
    activeOpsMembers: { value: number | null; confidence: "exact" };
  };
  personalSubscriptions: {
    activeRows: number;
    uniqueProfilesWithPersonalSub: number;
    payingProfiles: number;
    freePlanProfiles: number;
    byPlanKey: Record<string, number>;
    confidence: "exact";
  };
  orgSubscriptions: {
    activeRows: number;
    uniqueOrgsWithSub: number;
    payingOrgs: number;
    freePlanOrgs: number;
    byPlanKey: Record<string, number>;
    confidence: "exact";
  };
  ratios: {
    profileToPaidConversion: { value: number | null; note: string; confidence: "proxy" };
    orgToPaidConversion: { value: number | null; note: string; confidence: "proxy" };
    freeToPaidProfiles: { value: number | null; note: string; confidence: "proxy" };
    campaignsPerOrg: { value: number | null; note: string; confidence: "proxy" };
    participantRowsPerCampaign: { value: number | null; note: string; confidence: "proxy" };
  };
  disclaimers: string[];
};

function paidPlanKey(pk: PlanKey): boolean {
  return pk !== "free";
}

export async function fetchOpsFinancialReport(service: SupabaseClient): Promise<OpsFinancialReport> {
  const generatedAt = new Date().toISOString();
  const disclaimers = [
    "No Stripe settlement or invoice totals are stored in this schema — do not treat counts as recognized revenue.",
    "MRR, ARPU, and dollar revenue require billing exports or Stripe; they are not computed here.",
    "Conversion ratios use profile/org totals as denominators; users without a personal subscription row count as non-paying in the ratio.",
  ];

  const [
    { count: profilesTotal },
    { count: orgsTotal },
    { count: crmWorkspacesTotal },
    { count: crmCampaignsTotal },
    { count: crmCampaignsActive },
    { count: campaignParticipantRows },
    { count: activeOpsMembers },
    { data: profileSubs },
    { data: orgSubs },
  ] = await Promise.all([
    service.from("profiles").select("*", { count: "exact", head: true }),
    service.from("orgs").select("*", { count: "exact", head: true }),
    service.from("crm_workspaces").select("*", { count: "exact", head: true }),
    service.from("crm_campaigns").select("*", { count: "exact", head: true }),
    service.from("crm_campaigns").select("*", { count: "exact", head: true }).eq("status", "active"),
    service.from("crm_campaign_participants").select("*", { count: "exact", head: true }),
    service.from("internal_ops_members").select("*", { count: "exact", head: true }).is("revoked_at", null),
    service.from("subscriptions").select("owner_id, plan_key, tier, status").eq("owner_type", "profile").eq("status", "active"),
    service.from("subscriptions").select("owner_id, plan_key, tier, status").eq("owner_type", "org").eq("status", "active"),
  ]);

  const pRows = (profileSubs ?? []) as Array<{
    owner_id: string;
    plan_key?: string | null;
    tier?: string | null;
    status?: string | null;
  }>;
  const oRows = (orgSubs ?? []) as Array<{
    owner_id: string;
    plan_key?: string | null;
    tier?: string | null;
    status?: string | null;
  }>;

  const byPlanProfile = new Map<string, number>();
  const profileOwners = new Set<string>();
  let payingProfiles = 0;
  let freePlanProfiles = 0;
  for (const r of pRows) {
    profileOwners.add(r.owner_id);
    const pk = planKeyFromSubscriptionRow(r as SubscriptionPlanInput);
    byPlanProfile.set(pk, (byPlanProfile.get(pk) ?? 0) + 1);
    if (paidPlanKey(pk)) payingProfiles += 1;
    else freePlanProfiles += 1;
  }

  const byPlanOrg = new Map<string, number>();
  const orgOwners = new Set<string>();
  let payingOrgs = 0;
  let freePlanOrgs = 0;
  for (const r of oRows) {
    orgOwners.add(r.owner_id);
    const pk = planKeyFromSubscriptionRow(r as SubscriptionPlanInput);
    byPlanOrg.set(pk, (byPlanOrg.get(pk) ?? 0) + 1);
    if (paidPlanKey(pk)) payingOrgs += 1;
    else freePlanOrgs += 1;
  }

  const pt = profilesTotal ?? 0;
  const ot = orgsTotal ?? 0;
  const ct = crmCampaignsTotal ?? 0;
  const profileToPaidConversion = pt > 0 ? payingProfiles / pt : null;
  const orgToPaidConversion = ot > 0 ? payingOrgs / ot : null;
  const denomFreePaid = freePlanProfiles + payingProfiles;
  const freeToPaidProfiles =
    denomFreePaid > 0 ? payingProfiles / denomFreePaid : null;
  const campaignsPerOrg = ot > 0 && ct >= 0 ? ct / ot : null;
  const participantRowsPerCampaign = ct > 0 ? (campaignParticipantRows ?? 0) / ct : null;

  return {
    generatedAt,
    counts: {
      profilesTotal: { value: profilesTotal, confidence: "exact" },
      orgsTotal: { value: orgsTotal, confidence: "exact" },
      crmWorkspacesTotal: { value: crmWorkspacesTotal, confidence: "exact" },
      crmCampaignsTotal: { value: crmCampaignsTotal, confidence: "exact" },
      crmCampaignsActive: { value: crmCampaignsActive, confidence: "exact" },
      campaignParticipantRows: { value: campaignParticipantRows, confidence: "exact" },
      activeOpsMembers: { value: activeOpsMembers, confidence: "exact" },
    },
    personalSubscriptions: {
      activeRows: pRows.length,
      uniqueProfilesWithPersonalSub: profileOwners.size,
      payingProfiles,
      freePlanProfiles,
      byPlanKey: Object.fromEntries([...byPlanProfile.entries()].sort((a, b) => b[1] - a[1])),
      confidence: "exact",
    },
    orgSubscriptions: {
      activeRows: oRows.length,
      uniqueOrgsWithSub: orgOwners.size,
      payingOrgs,
      freePlanOrgs,
      byPlanKey: Object.fromEntries([...byPlanOrg.entries()].sort((a, b) => b[1] - a[1])),
      confidence: "exact",
    },
    ratios: {
      profileToPaidConversion: {
        value: profileToPaidConversion,
        note: "paying personal subs (non-free plan_key) ÷ total profiles",
        confidence: "proxy",
      },
      orgToPaidConversion: {
        value: orgToPaidConversion,
        note: "paying org subs ÷ total org rows",
        confidence: "proxy",
      },
      freeToPaidProfiles: {
        value: freeToPaidProfiles,
        note: "paying ÷ (free-plan personal subs + paying personal subs); excludes profiles with no sub row",
        confidence: "proxy",
      },
      campaignsPerOrg: {
        value: campaignsPerOrg,
        note: "all campaigns ÷ all orgs (not only orgs running campaigns)",
        confidence: "proxy",
      },
      participantRowsPerCampaign: {
        value: participantRowsPerCampaign,
        note: "participant rows ÷ campaigns; creators may be duplicated across campaigns",
        confidence: "proxy",
      },
    },
    disclaimers,
  };
}

export type OpsEntitlementRow = {
  id: string;
  kind: string;
  expires_at: string;
  payload_json: unknown;
  reason: string;
  created_at: string;
};

export async function fetchActiveEntitlementsForSubject(
  service: SupabaseClient,
  subject_type: "profile" | "org",
  subject_id: string
): Promise<OpsEntitlementRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await service
    .from("platform_ops_entitlements")
    .select("id, kind, expires_at, payload_json, reason, created_at")
    .eq("subject_type", subject_type)
    .eq("subject_id", subject_id)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: true });

  if (error) return [];
  return (data ?? []) as OpsEntitlementRow[];
}

export type OpsSubjectSubscription = {
  owner_type: "profile" | "org";
  owner_id: string;
  plan_key: string | null;
  tier: string | null;
  status: string | null;
  current_period_end: string | null;
} | null;

export async function fetchSubscriptionForOwner(
  service: SupabaseClient,
  owner_type: "profile" | "org",
  owner_id: string
): Promise<OpsSubjectSubscription> {
  const { data } = await service
    .from("subscriptions")
    .select("owner_type, owner_id, plan_key, tier, status, current_period_end")
    .eq("owner_type", owner_type)
    .eq("owner_id", owner_id)
    .eq("status", "active")
    .maybeSingle();

  if (!data) return null;
  const r = data as {
    owner_type: string;
    owner_id: string;
    plan_key?: string | null;
    tier?: string | null;
    status?: string | null;
    current_period_end?: string | null;
  };
  return {
    owner_type: owner_type,
    owner_id: r.owner_id,
    plan_key: r.plan_key ?? null,
    tier: r.tier ?? null,
    status: r.status ?? null,
    current_period_end: r.current_period_end ?? null,
  };
}

export type OpsSearchProfileHit = {
  type: "profile";
  id: string;
  username: string | null;
  display_name: string | null;
  email: string | null;
};

export type OpsSearchOrgHit = {
  type: "org";
  id: string;
  name: string | null;
  slug: string | null;
};

/** Safe fragment for PostgREST ilike OR filters (no commas/wildcards injected). */
function sanitizeOpsSearchQuery(q: string): string {
  return q.replace(/[%_,]/g, " ").trim().slice(0, 64);
}

/**
 * profiles.username / org slugs are stored without a leading @ (same as linkary.xyz public routes).
 * Searching "@handle" must still match username "handle".
 */
function handleSearchCore(safe: string): string {
  return safe.replace(/^@+/, "").trim();
}

export async function searchOpsProfiles(
  service: SupabaseClient,
  q: string,
  limit = 12
): Promise<OpsSearchProfileHit[]> {
  const safe = sanitizeOpsSearchQuery(q);
  if (safe.length < 2) return [];
  const core = handleSearchCore(safe);
  if (!core) return [];
  const pFull = `%${safe}%`;
  const pCore = `%${core}%`;
  const { data } = await service
    .from("profiles")
    .select("id, username, display_name, email")
    .or(
      `username.ilike.${pCore},twitter_username.ilike.${pCore},display_name.ilike.${pFull},email.ilike.${pFull}`
    )
    .limit(limit);

  return ((data ?? []) as Array<{ id: string; username: string | null; display_name: string | null; email?: string | null }>).map(
    (row) => ({
      type: "profile" as const,
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      email: row.email ?? null,
    })
  );
}

export async function searchOpsOrgs(service: SupabaseClient, q: string, limit = 12): Promise<OpsSearchOrgHit[]> {
  const safe = sanitizeOpsSearchQuery(q);
  if (safe.length < 2) return [];
  const core = handleSearchCore(safe);
  if (!core) return [];
  const pFull = `%${safe}%`;
  const pCore = `%${core}%`;
  const { data } = await service
    .from("orgs")
    .select("id, name, slug")
    .or(`name.ilike.${pFull},name.ilike.${pCore},slug.ilike.${pFull},slug.ilike.${pCore}`)
    .limit(limit);

  return ((data ?? []) as Array<{ id: string; name: string | null; slug: string | null }>).map((row) => ({
    type: "org" as const,
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export type OpsGrowthMetrics = {
  generatedAt: string;
  profilesNew7d: number | null;
  profilesNew30d: number | null;
  orgsNew7d: number | null;
  orgsNew30d: number | null;
  campaignsNew7d: number | null;
  campaignsNew30d: number | null;
  workspacesNew30d: number | null;
};

export async function fetchOpsGrowthMetrics(service: SupabaseClient): Promise<OpsGrowthMetrics> {
  const iso7 = daysAgoIso(7);
  const iso30 = daysAgoIso(30);
  const [
    { count: profilesNew7d },
    { count: profilesNew30d },
    { count: orgsNew7d },
    { count: orgsNew30d },
    { count: campaignsNew7d },
    { count: campaignsNew30d },
    { count: workspacesNew30d },
  ] = await Promise.all([
    service.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", iso7),
    service.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", iso30),
    service.from("orgs").select("*", { count: "exact", head: true }).gte("created_at", iso7),
    service.from("orgs").select("*", { count: "exact", head: true }).gte("created_at", iso30),
    service.from("crm_campaigns").select("*", { count: "exact", head: true }).gte("created_at", iso7),
    service.from("crm_campaigns").select("*", { count: "exact", head: true }).gte("created_at", iso30),
    service.from("crm_workspaces").select("*", { count: "exact", head: true }).gte("created_at", iso30),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    profilesNew7d,
    profilesNew30d,
    orgsNew7d,
    orgsNew30d,
    campaignsNew7d,
    campaignsNew30d,
    workspacesNew30d,
  };
}

export type OpsStatusCounts = Record<string, number>;

async function countWhere(
  service: SupabaseClient,
  table: string,
  filters: { column: string; value: string }[]
): Promise<number> {
  let q = service.from(table).select("*", { count: "exact", head: true });
  for (const f of filters) {
    q = q.eq(f.column, f.value);
  }
  const { count } = await q;
  return count ?? 0;
}

export async function fetchOpsSubmissionStatusCounts(service: SupabaseClient): Promise<OpsStatusCounts> {
  const statuses = ["pending", "approved", "rejected", "needs_revision"] as const;
  const entries = await Promise.all(
    statuses.map(async (s) => [s, await countWhere(service, "crm_submissions", [{ column: "status", value: s }])] as const)
  );
  return Object.fromEntries(entries);
}

export async function fetchOpsCampaignStatusCounts(service: SupabaseClient): Promise<OpsStatusCounts> {
  const statuses = ["draft", "active", "paused", "completed", "cancelled"] as const;
  const entries = await Promise.all(
    statuses.map(async (s) => [s, await countWhere(service, "crm_campaigns", [{ column: "status", value: s }])] as const)
  );
  return Object.fromEntries(entries);
}

export async function fetchOpsParticipantStatusCounts(service: SupabaseClient): Promise<OpsStatusCounts> {
  const statuses = ["invited", "accepted", "declined", "removed"] as const;
  const entries = await Promise.all(
    statuses.map(async (s) => [s, await countWhere(service, "crm_campaign_participants", [{ column: "status", value: s }])] as const)
  );
  return Object.fromEntries(entries);
}

export async function fetchOpsCreatorsProfileCount(service: SupabaseClient): Promise<number | null> {
  const { count } = await service
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("profile_type", "individual");
  return count;
}

export type OpsEntitlementUsageReport = {
  activeByKind: { comp_grant: number; discount_metadata: number; plan_override: number };
  recentlyRevoked: Array<{
    id: string;
    kind: string;
    subject_type: string;
    subject_id: string;
    revoked_at: string | null;
    expires_at: string;
    created_at: string;
  }>;
};

export async function fetchOpsEntitlementUsageReport(service: SupabaseClient): Promise<OpsEntitlementUsageReport> {
  const nowIso = new Date().toISOString();
  const [comp, disc, plan, revoked] = await Promise.all([
    service
      .from("platform_ops_entitlements")
      .select("*", { count: "exact", head: true })
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .eq("kind", "comp_grant"),
    service
      .from("platform_ops_entitlements")
      .select("*", { count: "exact", head: true })
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .eq("kind", "discount_metadata"),
    service
      .from("platform_ops_entitlements")
      .select("*", { count: "exact", head: true })
      .is("revoked_at", null)
      .gt("expires_at", nowIso)
      .eq("kind", "plan_override"),
    service
      .from("platform_ops_entitlements")
      .select("id, kind, subject_type, subject_id, revoked_at, expires_at, created_at")
      .not("revoked_at", "is", null)
      .order("revoked_at", { ascending: false })
      .limit(40),
  ]);

  return {
    activeByKind: {
      comp_grant: comp.count ?? 0,
      discount_metadata: disc.count ?? 0,
      plan_override: plan.count ?? 0,
    },
    recentlyRevoked: (revoked.data ?? []) as OpsEntitlementUsageReport["recentlyRevoked"],
  };
}

export type OpsMonetizationProxy = {
  campaignsWithBudgetCount: number | null;
  budgetSumUsdProxy: number | null;
  note: string;
};

export async function fetchOpsCampaignBudgetProxy(service: SupabaseClient): Promise<OpsMonetizationProxy> {
  const { data } = await service.from("crm_campaigns").select("budget, currency").not("budget", "is", null).limit(5000);
  const rows = (data ?? []) as Array<{ budget: number | null; currency: string | null }>;
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    if (r.budget != null && Number.isFinite(Number(r.budget))) {
      sum += Number(r.budget);
      n += 1;
    }
  }
  return {
    campaignsWithBudgetCount: n,
    budgetSumUsdProxy: n > 0 ? sum : null,
    note:
      "Sum of crm_campaigns.budget for rows where budget IS NOT NULL (capped scan 5000). Currency column ignored — labeled USD for display only; not Stripe cash.",
  };
}

export type OpsOrgSummaryRow = {
  org_id: string;
  name: string | null;
  slug: string | null;
  campaign_count: number;
  plan_key: PlanKey;
};

export async function fetchOpsOrgProjectSummary(service: SupabaseClient, limitOrgs = 40): Promise<OpsOrgSummaryRow[]> {
  const { data: camps } = await service.from("crm_campaigns").select("id, workspace_id").limit(4000);
  const campList = (camps ?? []) as { id: string; workspace_id: string }[];
  if (campList.length === 0) return [];

  const wsIds = [...new Set(campList.map((c) => c.workspace_id))];
  const { data: ws } = await service.from("crm_workspaces").select("id, linked_org_id").in("id", wsIds);
  const wsMap = new Map((ws ?? []).map((w) => [w.id as string, (w as { linked_org_id: string | null }).linked_org_id]));

  const orgCampaignCount = new Map<string, number>();
  for (const c of campList) {
    const oid = wsMap.get(c.workspace_id);
    if (!oid) continue;
    orgCampaignCount.set(oid, (orgCampaignCount.get(oid) ?? 0) + 1);
  }

  const sorted = [...orgCampaignCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, limitOrgs);
  if (sorted.length === 0) return [];

  const orgIds = sorted.map(([id]) => id);
  const { data: orgRows } = await service.from("orgs").select("id, name, slug").in("id", orgIds);
  const orgMeta = new Map((orgRows ?? []).map((o) => [o.id as string, o as { name: string | null; slug: string | null }]));

  const { data: subs } = await service
    .from("subscriptions")
    .select("owner_id, plan_key, tier, status, current_period_end")
    .eq("owner_type", "org")
    .eq("status", "active")
    .in("owner_id", orgIds);

  const subByOrg = new Map<string, PlanKey>();
  for (const s of subs ?? []) {
    const oid = (s as { owner_id: string }).owner_id;
    subByOrg.set(oid, planKeyFromSubscriptionRow(s as SubscriptionPlanInput));
  }

  return sorted.map(([org_id, campaign_count]) => {
    const meta = orgMeta.get(org_id);
    return {
      org_id,
      name: meta?.name ?? null,
      slug: meta?.slug ?? null,
      campaign_count,
      plan_key: subByOrg.get(org_id) ?? "free",
    };
  });
}

export type OpsCampaignKpiRow = {
  campaign_id: string;
  title: string;
  status: string;
  invited: number;
  accepted: number;
  submissions: number;
  approved_submissions: number;
};

export async function fetchOpsCampaignKpiRows(service: SupabaseClient, limit = 50): Promise<OpsCampaignKpiRow[]> {
  const { data: camps } = await service
    .from("crm_campaigns")
    .select("id, title, status")
    .order("updated_at", { ascending: false })
    .limit(limit);
  const list = (camps ?? []) as { id: string; title: string; status: string }[];
  if (list.length === 0) return [];

  const ids = list.map((c) => c.id);
  const [{ data: parts }, { data: subs }] = await Promise.all([
    service.from("crm_campaign_participants").select("campaign_id, status").in("campaign_id", ids),
    service.from("crm_submissions").select("campaign_id, status").in("campaign_id", ids),
  ]);

  const invited = new Map<string, number>();
  const accepted = new Map<string, number>();
  for (const p of parts ?? []) {
    const row = p as { campaign_id: string; status: string };
    if (row.status === "invited") invited.set(row.campaign_id, (invited.get(row.campaign_id) ?? 0) + 1);
    if (row.status === "accepted") accepted.set(row.campaign_id, (accepted.get(row.campaign_id) ?? 0) + 1);
  }

  const subTotal = new Map<string, number>();
  const subApproved = new Map<string, number>();
  for (const s of subs ?? []) {
    const row = s as { campaign_id: string; status: string };
    subTotal.set(row.campaign_id, (subTotal.get(row.campaign_id) ?? 0) + 1);
    if (row.status === "approved") subApproved.set(row.campaign_id, (subApproved.get(row.campaign_id) ?? 0) + 1);
  }

  return list.map((c) => ({
    campaign_id: c.id,
    title: c.title,
    status: c.status,
    invited: invited.get(c.id) ?? 0,
    accepted: accepted.get(c.id) ?? 0,
    submissions: subTotal.get(c.id) ?? 0,
    approved_submissions: subApproved.get(c.id) ?? 0,
  }));
}

export type OpsOrgRow = {
  org_id: string;
  name: string | null;
  slug: string | null;
  created_at: string | null;
  plan_key: PlanKey;
  subscription_status: string | null;
};

export async function fetchOpsOrgRows(service: SupabaseClient, limit = 120): Promise<OpsOrgRow[]> {
  const { data: orgs } = await service.from("orgs").select("id, name, slug, created_at").order("created_at", { ascending: false }).limit(limit);
  const list = (orgs ?? []) as { id: string; name: string | null; slug: string | null; created_at: string | null }[];
  if (list.length === 0) return [];

  const ids = list.map((o) => o.id);
  const { data: subs } = await service
    .from("subscriptions")
    .select("owner_id, plan_key, tier, status, current_period_end")
    .eq("owner_type", "org")
    .in("owner_id", ids);

  const subMap = new Map<string, { plan_key: PlanKey; status: string | null }>();
  for (const s of subs ?? []) {
    const r = s as { owner_id: string; plan_key?: string | null; tier?: string | null; status?: string | null; current_period_end?: string | null };
    subMap.set(r.owner_id, {
      plan_key: planKeyFromSubscriptionRow(r),
      status: r.status ?? null,
    });
  }

  return list.map((o) => {
    const s = subMap.get(o.id);
    return {
      org_id: o.id,
      name: o.name,
      slug: o.slug,
      created_at: o.created_at,
      plan_key: s?.plan_key ?? "free",
      subscription_status: s?.status ?? null,
    };
  });
}

export type OpsEntitlementSampleRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  kind: string;
  expires_at: string;
  reason: string;
  created_at: string;
};

export async function fetchOpsActiveEntitlementsSample(service: SupabaseClient, limit = 80): Promise<OpsEntitlementSampleRow[]> {
  const nowIso = new Date().toISOString();
  const { data } = await service
    .from("platform_ops_entitlements")
    .select("id, subject_type, subject_id, kind, expires_at, reason, created_at")
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("expires_at", { ascending: true })
    .limit(limit);

  return (data ?? []) as OpsEntitlementSampleRow[];
}

export async function fetchOpsRecentSubmissions(service: SupabaseClient, limit = 60) {
  const { data } = await service
    .from("crm_submissions")
    .select("id, campaign_id, status, created_at, participant_profile_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Array<{
    id: string;
    campaign_id: string;
    status: string;
    created_at: string;
    participant_profile_id: string;
  }>;
}

export type OpsSubmissionRowEnriched = {
  id: string;
  campaign_id: string;
  status: string;
  created_at: string;
  participant_profile_id: string;
  campaign_title: string | null;
};

export async function fetchOpsRecentSubmissionsEnriched(
  service: SupabaseClient,
  limit = 60
): Promise<OpsSubmissionRowEnriched[]> {
  const rows = await fetchOpsRecentSubmissions(service, limit);
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.campaign_id))];
  const { data: camps } = await service.from("crm_campaigns").select("id, title").in("id", ids);
  const titles = new Map<string, string>();
  for (const c of camps ?? []) {
    const row = c as { id: string; title: string };
    titles.set(row.id, row.title);
  }
  return rows.map((r) => ({ ...r, campaign_title: titles.get(r.campaign_id) ?? null }));
}

export type OpsPlanDistributionRow = {
  owner_type: "profile" | "org";
  plan_key: PlanKey;
  subscription_rows: number;
};

/** Active subscription rows grouped by resolved plan_key (exact). */
export async function fetchOpsPlanDistribution(service: SupabaseClient): Promise<OpsPlanDistributionRow[]> {
  const [{ data: prof }, { data: org }] = await Promise.all([
    service.from("subscriptions").select("plan_key, tier, status, current_period_end").eq("owner_type", "profile").eq("status", "active"),
    service.from("subscriptions").select("plan_key, tier, status, current_period_end").eq("owner_type", "org").eq("status", "active"),
  ]);

  const map = new Map<string, OpsPlanDistributionRow>();
  for (const r of prof ?? []) {
    const pk = planKeyFromSubscriptionRow(r as SubscriptionPlanInput);
    const key = `profile|||${pk}`;
    const cur = map.get(key);
    if (cur) cur.subscription_rows += 1;
    else map.set(key, { owner_type: "profile", plan_key: pk, subscription_rows: 1 });
  }
  for (const r of org ?? []) {
    const pk = planKeyFromSubscriptionRow(r as SubscriptionPlanInput);
    const key = `org|||${pk}`;
    const cur = map.get(key);
    if (cur) cur.subscription_rows += 1;
    else map.set(key, { owner_type: "org", plan_key: pk, subscription_rows: 1 });
  }

  return [...map.values()].sort((a, b) => b.subscription_rows - a.subscription_rows);
}
