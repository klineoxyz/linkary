import type { SupabaseClient } from "@supabase/supabase-js";
import { planKeyFromSubscriptionRow, type PlanKey } from "@/lib/planKey";

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
        planKeyFromSubscriptionRow(row as Parameters<typeof planKeyFromSubscriptionRow>[0])
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

export async function fetchOpsAuditRows(service: SupabaseClient, limit = 100): Promise<OpsAuditRow[]> {
  const { data } = await service
    .from("platform_audit_log")
    .select("id, actor_user_id, action, target_type, target_id, payload_json, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as OpsAuditRow[];
}
