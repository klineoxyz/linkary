import type { SupabaseClient } from "@supabase/supabase-js";
import { planKeyFromSubscriptionRow, type PlanKey, type SubscriptionPlanInput } from "@/lib/planKey";

const PAGE = 1000;
/** Hard safety stop for runaway scans; UI must show truncation if hit. */
const MAX_SCAN_ROWS = 500_000;

export type OpsPaginatedResult<T> = { rows: T[]; scanned: number; truncated: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateTable<T>(
  service: SupabaseClient,
  table: string,
  select: string,
  apply: (q: any) => any
): Promise<OpsPaginatedResult<T>> {
  const rows: T[] = [];
  let start = 0;
  let truncated = false;
  while (start < MAX_SCAN_ROWS) {
    let q = service.from(table).select(select);
    q = apply(q);
    const { data, error } = await q.range(start, start + PAGE - 1);
    if (error) break;
    const batch = (data ?? []) as T[];
    if (batch.length === 0) break;
    rows.push(...batch);
    start += batch.length;
    if (batch.length < PAGE) break;
  }
  if (start >= MAX_SCAN_ROWS) truncated = true;
  return { rows, scanned: start, truncated };
}

export async function fetchOpsCampaignBudgetRollup(service: SupabaseClient): Promise<{
  rowsWithBudget: number;
  sumBudgetNumeric: number;
  currencyNote: string;
  scanned: number;
  truncated: boolean;
}> {
  const { rows, scanned, truncated } = await paginateTable<{ budget: number | null; currency: string | null }>(
    service,
    "crm_campaigns",
    "budget, currency",
    (q) => q.not("budget", "is", null)
  );
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    if (r.budget != null && Number.isFinite(Number(r.budget))) {
      sum += Number(r.budget);
      n += 1;
    }
  }
  return {
    rowsWithBudget: n,
    sumBudgetNumeric: n > 0 ? sum : 0,
    currencyNote:
      "crm_campaigns.budget + currency per row; sum treats numeric budget as display-only (proxy — not Stripe, not normalized FX).",
    scanned,
    truncated,
  };
}

/** workspace_id -> linked_org_id (nulls excluded from rollup keys) */
export async function fetchWorkspaceOrgMap(service: SupabaseClient): Promise<{
  map: Map<string, string>;
  scanned: number;
  truncated: boolean;
}> {
  const { rows, scanned, truncated } = await paginateTable<{ id: string; linked_org_id: string | null }>(
    service,
    "crm_workspaces",
    "id, linked_org_id",
    (q) => q.not("linked_org_id", "is", null)
  );
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.linked_org_id) map.set(r.id, r.linked_org_id);
  }
  return { map, scanned, truncated };
}

/** org_id -> count of campaigns (linked workspaces only) */
export async function fetchOrgCampaignCounts(service: SupabaseClient): Promise<{
  counts: Map<string, number>;
  scannedCampaigns: number;
  truncated: boolean;
}> {
  const { map: wsToOrg, truncated: tw } = await fetchWorkspaceOrgMap(service);
  const { rows, scanned, truncated } = await paginateTable<{ workspace_id: string }>(
    service,
    "crm_campaigns",
    "workspace_id",
    (q) => q
  );
  const counts = new Map<string, number>();
  for (const r of rows) {
    const oid = wsToOrg.get(r.workspace_id);
    if (!oid) continue;
    counts.set(oid, (counts.get(oid) ?? 0) + 1);
  }
  return { counts, scannedCampaigns: scanned, truncated: truncated || tw };
}

export type OpsOrgListRow = {
  org_id: string;
  name: string | null;
  slug: string | null;
  campaign_count: number;
  plan_key: PlanKey;
};

export async function fetchOpsOrgReportList(
  service: SupabaseClient,
  opts: { q: string; planKey: string | null; limit: number; offset: number }
): Promise<{ rows: OpsOrgListRow[]; totalMatching: number; rollupTruncated: boolean }> {
  const { counts, truncated } = await fetchOrgCampaignCounts(service);
  let orderedIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  const safeQ = opts.q.replace(/[%_,]/g, " ").trim();
  if (safeQ.length >= 2) {
    const p = `%${safeQ}%`;
    const { data: hit } = await service.from("orgs").select("id").or(`name.ilike.${p},slug.ilike.${p}`).limit(2000);
    const allow = new Set((hit ?? []).map((r) => (r as { id: string }).id));
    const filtered = orderedIds.filter((id) => allow.has(id));
    if (filtered.length > 0) {
      orderedIds = filtered;
    } else {
      orderedIds = [...allow];
    }
  }

  const planMap = new Map<string, PlanKey>();
  for (let i = 0; i < orderedIds.length; i += 150) {
    const slice = orderedIds.slice(i, i + 150);
    const { data: subs } = await service
      .from("subscriptions")
      .select("owner_id, plan_key, tier, status, current_period_end")
      .eq("owner_type", "org")
      .eq("status", "active")
      .in("owner_id", slice);
    for (const s of subs ?? []) {
      const r = s as { owner_id: string };
      planMap.set(r.owner_id, planKeyFromSubscriptionRow(s as SubscriptionPlanInput));
    }
  }

  if (opts.planKey) {
    orderedIds = orderedIds.filter((id) => (planMap.get(id) ?? "free") === opts.planKey);
  }

  const totalMatching = orderedIds.length;
  const pageIds = orderedIds.slice(opts.offset, opts.offset + opts.limit);
  if (pageIds.length === 0) {
    return { rows: [], totalMatching, rollupTruncated: truncated };
  }

  const { data: orgRows } = await service.from("orgs").select("id, name, slug").in("id", pageIds);
  const meta = new Map((orgRows ?? []).map((o) => [o.id as string, o as { name: string | null; slug: string | null }]));

  const rows: OpsOrgListRow[] = pageIds.map((id) => {
    const m = meta.get(id);
    return {
      org_id: id,
      name: m?.name ?? null,
      slug: m?.slug ?? null,
      campaign_count: counts.get(id) ?? 0,
      plan_key: planMap.get(id) ?? "free",
    };
  });

  return { rows, totalMatching, rollupTruncated: truncated };
}

export type OpsOrgCampaignRow = {
  id: string;
  title: string;
  status: string;
  workspace_id: string;
  starts_at: string | null;
  ends_at: string | null;
  budget: number | null;
  currency: string | null;
  campaign_value_usd: number | null;
  created_at: string;
  invited: number;
  accepted: number;
  declined: number;
  submissions: number;
  approved_submissions: number;
  rejected_submissions: number;
  needs_revision_submissions: number;
  pending_submissions: number;
};

export type OpsOrgDetailReport = {
  org: { id: string; name: string | null; slug: string | null; created_at: string | null };
  plan_key: PlanKey;
  workspaces: Array<{ id: string; name: string; slug: string | null }>;
  campaigns: OpsOrgCampaignRow[];
  totals: {
    campaigns: number;
    active: number;
    completed: number;
    invited: number;
    accepted: number;
    submissions: number;
    approved_submissions: number;
  };
  entitlements: Array<{ id: string; kind: string; expires_at: string; reason: string }>;
  scanNote: string | null;
};

export async function fetchOpsOrgDetailReport(service: SupabaseClient, orgId: string): Promise<OpsOrgDetailReport | null> {
  const { data: org } = await service.from("orgs").select("id, name, slug, created_at").eq("id", orgId).maybeSingle();
  if (!org) return null;

  const { data: subs } = await service
    .from("subscriptions")
    .select("owner_id, plan_key, tier, status, current_period_end")
    .eq("owner_type", "org")
    .eq("owner_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  const plan_key = subs
    ? planKeyFromSubscriptionRow(subs as SubscriptionPlanInput)
    : ("free" as PlanKey);

  const { data: wss } = await service.from("crm_workspaces").select("id, name, slug").eq("linked_org_id", orgId);
  const workspaces = (wss ?? []) as Array<{ id: string; name: string; slug: string | null }>;
  const wsIds = workspaces.map((w) => w.id);
  if (wsIds.length === 0) {
    const nowIso = new Date().toISOString();
    const { data: ent } = await service
      .from("platform_ops_entitlements")
      .select("id, kind, expires_at, reason")
      .eq("subject_type", "org")
      .eq("subject_id", orgId)
      .is("revoked_at", null)
      .gt("expires_at", nowIso);
    return {
      org: org as OpsOrgDetailReport["org"],
      plan_key,
      workspaces: [],
      campaigns: [],
      totals: {
        campaigns: 0,
        active: 0,
        completed: 0,
        invited: 0,
        accepted: 0,
        submissions: 0,
        approved_submissions: 0,
      },
      entitlements: (ent ?? []) as OpsOrgDetailReport["entitlements"],
      scanNote: null,
    };
  }

  const campRows: Array<{
    id: string;
    title: string;
    status: string;
    workspace_id: string;
    starts_at: string | null;
    ends_at: string | null;
    budget: number | null;
    currency: string | null;
    campaign_value_usd: number | null;
    created_at: string;
  }> = [];
  let truncated = false;
  for (let i = 0; i < wsIds.length; i += 80) {
    const slice = wsIds.slice(i, i + 80);
    let start = 0;
    while (start < MAX_SCAN_ROWS) {
      const { data, error } = await service
        .from("crm_campaigns")
        .select(
          "id, title, status, workspace_id, starts_at, ends_at, budget, currency, campaign_value_usd, created_at"
        )
        .in("workspace_id", slice)
        .order("updated_at", { ascending: false })
        .range(start, start + PAGE - 1);
      if (error) break;
      const batch = (data ?? []) as typeof campRows;
      if (batch.length === 0) break;
      campRows.push(...batch);
      start += batch.length;
      if (batch.length < PAGE) break;
    }
    if (start >= MAX_SCAN_ROWS) truncated = true;
  }

  const campIds = campRows.map((c) => c.id);
  const partByCamp = new Map<string, { invited: number; accepted: number; declined: number }>();
  const subByCamp = new Map<
    string,
    { total: number; approved: number; rejected: number; needs_revision: number; pending: number }
  >();

  for (let i = 0; i < campIds.length; i += 120) {
    const slice = campIds.slice(i, i + 120);
    const [{ data: parts }, { data: subsRows }] = await Promise.all([
      service.from("crm_campaign_participants").select("campaign_id, status").in("campaign_id", slice),
      service.from("crm_submissions").select("campaign_id, status").in("campaign_id", slice),
    ]);
    for (const p of parts ?? []) {
      const r = p as { campaign_id: string; status: string };
      const cur = partByCamp.get(r.campaign_id) ?? { invited: 0, accepted: 0, declined: 0 };
      if (r.status === "invited") cur.invited += 1;
      if (r.status === "accepted") cur.accepted += 1;
      if (r.status === "declined") cur.declined += 1;
      partByCamp.set(r.campaign_id, cur);
    }
    for (const s of subsRows ?? []) {
      const r = s as { campaign_id: string; status: string };
      const cur = subByCamp.get(r.campaign_id) ?? {
        total: 0,
        approved: 0,
        rejected: 0,
        needs_revision: 0,
        pending: 0,
      };
      cur.total += 1;
      if (r.status === "approved") cur.approved += 1;
      else if (r.status === "rejected") cur.rejected += 1;
      else if (r.status === "needs_revision") cur.needs_revision += 1;
      else cur.pending += 1;
      subByCamp.set(r.campaign_id, cur);
    }
  }

  const campaigns: OpsOrgCampaignRow[] = campRows.map((c) => {
    const p = partByCamp.get(c.id) ?? { invited: 0, accepted: 0, declined: 0 };
    const s = subByCamp.get(c.id) ?? { total: 0, approved: 0, rejected: 0, needs_revision: 0, pending: 0 };
    return {
      id: c.id,
      title: c.title,
      status: c.status,
      workspace_id: c.workspace_id,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      budget: c.budget,
      currency: c.currency,
      campaign_value_usd: c.campaign_value_usd,
      created_at: c.created_at,
      invited: p.invited,
      accepted: p.accepted,
      declined: p.declined,
      submissions: s.total,
      approved_submissions: s.approved,
      rejected_submissions: s.rejected,
      needs_revision_submissions: s.needs_revision,
      pending_submissions: s.pending,
    };
  });

  let active = 0;
  let completed = 0;
  let inv = 0;
  let acc = 0;
  let sub = 0;
  let app = 0;
  for (const c of campaigns) {
    if (c.status === "active") active += 1;
    if (c.status === "completed") completed += 1;
    inv += c.invited;
    acc += c.accepted;
    sub += c.submissions;
    app += c.approved_submissions;
  }

  const nowIso = new Date().toISOString();
  const { data: ent } = await service
    .from("platform_ops_entitlements")
    .select("id, kind, expires_at, reason")
    .eq("subject_type", "org")
    .eq("subject_id", orgId)
    .is("revoked_at", null)
    .gt("expires_at", nowIso);

  return {
    org: org as OpsOrgDetailReport["org"],
    plan_key,
    workspaces,
    campaigns,
    totals: {
      campaigns: campaigns.length,
      active,
      completed,
      invited: inv,
      accepted: acc,
      submissions: sub,
      approved_submissions: app,
    },
    entitlements: (ent ?? []) as OpsOrgDetailReport["entitlements"],
    scanNote: truncated ? "Campaign list truncated at internal scan safety limit — refine workspace split or contact engineering." : null,
  };
}

export type OpsCampaignListRow = {
  campaign_id: string;
  title: string;
  status: string;
  workspace_id: string;
  workspace_name: string | null;
  linked_org_id: string | null;
  org_name: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  budget: number | null;
  currency: string | null;
  invited: number;
  accepted: number;
  submissions: number;
  approved_submissions: number;
};

export async function fetchOpsCampaignReportList(
  service: SupabaseClient,
  opts: {
    fromIso: string | null;
    toIso: string | null;
    status: string | null;
    q: string;
    limit: number;
    offset: number;
    orgId: string | null;
  }
): Promise<{ rows: OpsCampaignListRow[]; scanned: number; truncated: boolean; totalInSample: number }> {
  const { map: wsToOrg, truncated: tw } = await fetchWorkspaceOrgMap(service);
  const orgMeta = new Map<string, { name: string | null }>();
  const orgIds = [...new Set(wsToOrg.values())];
  if (orgIds.length > 0) {
    const { data: os } = await service.from("orgs").select("id, name").in("id", orgIds.slice(0, 500));
    for (const o of os ?? []) orgMeta.set((o as { id: string }).id, { name: (o as { name: string | null }).name });
  }

  const { rows: rawCamps, scanned, truncated } = await paginateTable<{
    id: string;
    title: string;
    status: string;
    workspace_id: string;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    budget: number | null;
    currency: string | null;
  }>(service, "crm_campaigns", "id, title, status, workspace_id, starts_at, ends_at, created_at, budget, currency", (q) => {
    let qq = q.order("updated_at", { ascending: false });
    if (opts.fromIso) qq = qq.gte("created_at", opts.fromIso);
    if (opts.toIso) qq = qq.lte("created_at", opts.toIso);
    if (opts.status) qq = qq.eq("status", opts.status);
    return qq;
  });

  let filtered = rawCamps.filter((c) => {
    const oid = wsToOrg.get(c.workspace_id);
    if (opts.orgId && oid !== opts.orgId) return false;
    if (opts.q.length >= 2 && !c.title?.toLowerCase().includes(opts.q.toLowerCase())) return false;
    return true;
  });

  const campIds = filtered.map((c) => c.id);
  const kpiMap = new Map<string, { invited: number; accepted: number; submissions: number; approved: number }>();
  for (let i = 0; i < campIds.length; i += 100) {
    const slice = campIds.slice(i, i + 100);
    const [{ data: parts }, { data: subs }] = await Promise.all([
      service.from("crm_campaign_participants").select("campaign_id, status").in("campaign_id", slice),
      service.from("crm_submissions").select("campaign_id, status").in("campaign_id", slice),
    ]);
    for (const p of parts ?? []) {
      const r = p as { campaign_id: string; status: string };
      const cur = kpiMap.get(r.campaign_id) ?? { invited: 0, accepted: 0, submissions: 0, approved: 0 };
      if (r.status === "invited") cur.invited += 1;
      if (r.status === "accepted") cur.accepted += 1;
      kpiMap.set(r.campaign_id, cur);
    }
    for (const s of subs ?? []) {
      const r = s as { campaign_id: string; status: string };
      const cur = kpiMap.get(r.campaign_id) ?? { invited: 0, accepted: 0, submissions: 0, approved: 0 };
      cur.submissions += 1;
      if (r.status === "approved") cur.approved += 1;
      kpiMap.set(r.campaign_id, cur);
    }
  }

  const wsNameMap = new Map<string, string | null>();
  const wsIds = [...new Set(filtered.map((c) => c.workspace_id))];
  for (let i = 0; i < wsIds.length; i += 100) {
    const { data: w } = await service.from("crm_workspaces").select("id, name").in("id", wsIds.slice(i, i + 100));
    for (const row of w ?? []) wsNameMap.set((row as { id: string }).id, (row as { name: string }).name ?? null);
  }

  const rows: OpsCampaignListRow[] = filtered.map((c) => {
    const oid = wsToOrg.get(c.workspace_id) ?? null;
    const k = kpiMap.get(c.id) ?? { invited: 0, accepted: 0, submissions: 0, approved: 0 };
    return {
      campaign_id: c.id,
      title: c.title,
      status: c.status,
      workspace_id: c.workspace_id,
      workspace_name: wsNameMap.get(c.workspace_id) ?? null,
      linked_org_id: oid,
      org_name: oid ? orgMeta.get(oid)?.name ?? null : null,
      starts_at: c.starts_at,
      ends_at: c.ends_at,
      created_at: c.created_at,
      budget: c.budget,
      currency: c.currency,
      invited: k.invited,
      accepted: k.accepted,
      submissions: k.submissions,
      approved_submissions: k.approved,
    };
  });

  const totalInSample = rows.length;
  const pageRows = rows.slice(opts.offset, opts.offset + opts.limit);

  return { rows: pageRows, scanned, truncated: truncated || tw, totalInSample };
}

export type OpsCampaignDetailReport = {
  campaign: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    workspace_id: string;
    starts_at: string | null;
    ends_at: string | null;
    budget: number | null;
    currency: string | null;
    campaign_value_usd: number | null;
    payout_model: string | null;
    follow_rules: unknown;
    created_at: string;
    updated_at: string;
  };
  workspace: { id: string; name: string; slug: string | null; linked_org_id: string | null } | null;
  org: { id: string; name: string | null; slug: string | null } | null;
  org_plan_key: PlanKey;
  participants: Array<{
    id: string;
    participant_profile_id: string;
    status: string;
    invited_at: string;
    accepted_at: string | null;
    x_follow_attestation: unknown;
    x_follow_verification: unknown;
  }>;
  submissions: Array<{
    id: string;
    platform: string;
    status: string;
    created_at: string;
    reviewed_at: string | null;
    participant_profile_id: string;
    url: string;
  }>;
  stats: {
    invited: number;
    accepted: number;
    declined: number;
    removed: number;
    submissions: number;
    approved: number;
    rejected: number;
    needs_revision: number;
    pending: number;
    byPlatform: Record<string, number>;
    firstSubmissionAt: string | null;
    lastSubmissionAt: string | null;
    medianHoursInviteToSubmit: number | null;
  };
  submissionsTruncated: boolean;
};

export async function fetchOpsCampaignDetailReport(
  service: SupabaseClient,
  campaignId: string
): Promise<OpsCampaignDetailReport | null> {
  const { data: camp } = await service
    .from("crm_campaigns")
    .select(
      "id, title, description, status, workspace_id, starts_at, ends_at, budget, currency, campaign_value_usd, payout_model, follow_rules, created_at, updated_at"
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (!camp) return null;

  const c = camp as OpsCampaignDetailReport["campaign"];

  const { data: ws } = await service
    .from("crm_workspaces")
    .select("id, name, slug, linked_org_id")
    .eq("id", c.workspace_id)
    .maybeSingle();
  const workspace = ws as OpsCampaignDetailReport["workspace"];

  let org: OpsCampaignDetailReport["org"] = null;
  let org_plan_key: PlanKey = "free";
  if (workspace?.linked_org_id) {
    const { data: o } = await service.from("orgs").select("id, name, slug").eq("id", workspace.linked_org_id).maybeSingle();
    org = o as OpsCampaignDetailReport["org"];
    const { data: sub } = await service
      .from("subscriptions")
      .select("owner_id, plan_key, tier, status, current_period_end")
      .eq("owner_type", "org")
      .eq("owner_id", workspace.linked_org_id)
      .eq("status", "active")
      .maybeSingle();
    if (sub) org_plan_key = planKeyFromSubscriptionRow(sub as SubscriptionPlanInput);
  }

  const participants: OpsCampaignDetailReport["participants"] = [];
  let pStart = 0;
  let submissionsTruncated = false;
  while (pStart < MAX_SCAN_ROWS) {
    const { data } = await service
      .from("crm_campaign_participants")
      .select("id, participant_profile_id, status, invited_at, accepted_at, x_follow_attestation, x_follow_verification")
      .eq("campaign_id", campaignId)
      .range(pStart, pStart + PAGE - 1);
    const batch = (data ?? []) as OpsCampaignDetailReport["participants"];
    if (batch.length === 0) break;
    participants.push(...batch);
    pStart += batch.length;
    if (batch.length < PAGE) break;
  }
  if (pStart >= MAX_SCAN_ROWS) submissionsTruncated = true;

  const submissions: OpsCampaignDetailReport["submissions"] = [];
  let sStart = 0;
  while (sStart < MAX_SCAN_ROWS) {
    const { data } = await service
      .from("crm_submissions")
      .select("id, platform, status, created_at, reviewed_at, participant_profile_id, url")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true })
      .range(sStart, sStart + PAGE - 1);
    const batch = (data ?? []) as OpsCampaignDetailReport["submissions"];
    if (batch.length === 0) break;
    submissions.push(...batch);
    sStart += batch.length;
    if (batch.length < PAGE) break;
  }
  if (sStart >= MAX_SCAN_ROWS) submissionsTruncated = true;

  let invited = 0,
    accepted = 0,
    declined = 0,
    removed = 0;
  for (const p of participants) {
    if (p.status === "invited") invited += 1;
    if (p.status === "accepted") accepted += 1;
    if (p.status === "declined") declined += 1;
    if (p.status === "removed") removed += 1;
  }

  const byPlatform: Record<string, number> = {};
  let approved = 0,
    rejected = 0,
    needs_revision = 0,
    pending = 0;
  for (const s of submissions) {
    byPlatform[s.platform] = (byPlatform[s.platform] ?? 0) + 1;
    if (s.status === "approved") approved += 1;
    else if (s.status === "rejected") rejected += 1;
    else if (s.status === "needs_revision") needs_revision += 1;
    else pending += 1;
  }

  const firstSubmissionAt = submissions.length ? submissions[0].created_at : null;
  const lastSubmissionAt = submissions.length ? submissions[submissions.length - 1].created_at : null;

  const hoursList: number[] = [];
  for (const p of participants) {
    if (p.status !== "accepted" || !p.accepted_at) continue;
    const subsForP = submissions.filter((s) => s.participant_profile_id === p.participant_profile_id);
    if (subsForP.length === 0) continue;
    const first = subsForP.reduce((a, b) => (a.created_at < b.created_at ? a : b));
    const delta = (Date.parse(first.created_at) - Date.parse(p.accepted_at)) / 36e5;
    if (Number.isFinite(delta) && delta >= 0) hoursList.push(delta);
  }
  hoursList.sort((a, b) => a - b);
  let medianHoursInviteToSubmit: number | null = null;
  if (hoursList.length > 0) {
    const mid = Math.floor(hoursList.length / 2);
    medianHoursInviteToSubmit =
      hoursList.length % 2 === 0 ? (hoursList[mid - 1]! + hoursList[mid]!) / 2 : hoursList[mid]!;
  }

  return {
    campaign: c,
    workspace,
    org,
    org_plan_key,
    participants,
    submissions,
    stats: {
      invited,
      accepted,
      declined,
      removed,
      submissions: submissions.length,
      approved,
      rejected,
      needs_revision,
      pending,
      byPlatform,
      firstSubmissionAt,
      lastSubmissionAt,
      medianHoursInviteToSubmit,
    },
    submissionsTruncated,
  };
}

export type OpsCreatorSummaryRow = {
  profile_id: string;
  username: string | null;
  display_name: string | null;
  campaigns_joined: number;
  participant_accepted: number;
  submissions: number;
  approved_submissions: number;
  avgHoursAcceptToFirstSubmit: number | null;
};

export async function fetchOpsCreatorLeaderboard(
  service: SupabaseClient,
  opts: {
    partStatus: string | null;
    campaignId: string | null;
    orgId: string | null;
    q: string;
    limit: number;
    offset: number;
  }
): Promise<{ rows: OpsCreatorSummaryRow[]; truncated: boolean; scannedParticipants: number }> {
  let allowedCampaigns: Set<string> | null = null;
  if (opts.orgId) {
    const { data: wss } = await service.from("crm_workspaces").select("id").eq("linked_org_id", opts.orgId);
    const wsIds = (wss ?? []).map((w) => (w as { id: string }).id);
    if (wsIds.length === 0) return { rows: [], truncated: false, scannedParticipants: 0 };
    const { data: camps } = await service.from("crm_campaigns").select("id").in("workspace_id", wsIds);
    allowedCampaigns = new Set((camps ?? []).map((c) => (c as { id: string }).id));
  }

  type PRow = {
    campaign_id: string;
    participant_profile_id: string;
    status: string;
    invited_at: string;
    accepted_at: string | null;
  };
  const parts: PRow[] = [];
  let start = 0;
  let truncated = false;
  while (start < MAX_SCAN_ROWS) {
    let q = service
      .from("crm_campaign_participants")
      .select("campaign_id, participant_profile_id, status, invited_at, accepted_at")
      .range(start, start + PAGE - 1);
    if (opts.campaignId) q = q.eq("campaign_id", opts.campaignId);
    if (opts.partStatus) q = q.eq("status", opts.partStatus);
    const { data } = await q;
    const batch = (data ?? []) as PRow[];
    if (batch.length === 0) break;
    for (const row of batch) {
      if (allowedCampaigns && !allowedCampaigns.has(row.campaign_id)) continue;
      parts.push(row);
    }
    start += batch.length;
    if (batch.length < PAGE) break;
  }
  if (start >= MAX_SCAN_ROWS) truncated = true;

  const byProfile = new Map<
    string,
    {
      campaigns: Set<string>;
      accepted: number;
    }
  >();
  for (const p of parts) {
    const cur = byProfile.get(p.participant_profile_id) ?? {
      campaigns: new Set<string>(),
      accepted: 0,
    };
    cur.campaigns.add(p.campaign_id);
    if (p.status === "accepted") cur.accepted += 1;
    byProfile.set(p.participant_profile_id, cur);
  }

  if (opts.q.length >= 2) {
    const p = `%${opts.q.replace(/[%_,]/g, " ").trim()}%`;
    const { data: profs } = await service
      .from("profiles")
      .select("id, username, display_name")
      .or(`username.ilike.${p},display_name.ilike.${p}`)
      .limit(400);
    const allow = new Set((profs ?? []).map((x) => (x as { id: string }).id));
    for (const pid of [...byProfile.keys()]) {
      if (!allow.has(pid)) byProfile.delete(pid);
    }
  }

  let profileIds = [...byProfile.keys()];
  const submissionStats = new Map<string, { total: number; approved: number }>();
  const hoursByProfile = new Map<string, number[]>();
  const firstSubTime = new Map<string, string>();

  for (let i = 0; i < profileIds.length; i += 80) {
    const slice = profileIds.slice(i, i + 80);
    let subStart = 0;
    while (subStart < MAX_SCAN_ROWS) {
      let sq = service
        .from("crm_submissions")
        .select("participant_profile_id, status, created_at, campaign_id")
        .in("participant_profile_id", slice)
        .range(subStart, subStart + PAGE - 1);
      if (opts.campaignId) sq = sq.eq("campaign_id", opts.campaignId);
      const { data: subs } = await sq;
      const batch = (subs ?? []) as Array<{
        participant_profile_id: string;
        status: string;
        created_at: string;
        campaign_id: string;
      }>;
      if (batch.length === 0) break;
      for (const s of batch) {
        if (allowedCampaigns && !allowedCampaigns.has(s.campaign_id)) continue;
        const cur = submissionStats.get(s.participant_profile_id) ?? { total: 0, approved: 0 };
        cur.total += 1;
        if (s.status === "approved") cur.approved += 1;
        submissionStats.set(s.participant_profile_id, cur);
        const key = `${s.participant_profile_id}|||${s.campaign_id}`;
        const prev = firstSubTime.get(key);
        if (!prev || s.created_at < prev) firstSubTime.set(key, s.created_at);
      }
      subStart += batch.length;
      if (batch.length < PAGE) break;
    }
  }

  for (const p of parts) {
    if (p.status !== "accepted" || !p.accepted_at) continue;
    if (allowedCampaigns && !allowedCampaigns.has(p.campaign_id)) continue;
    if (opts.campaignId && p.campaign_id !== opts.campaignId) continue;
    const key = `${p.participant_profile_id}|||${p.campaign_id}`;
    const first = firstSubTime.get(key);
    if (!first) continue;
    const h = (Date.parse(first) - Date.parse(p.accepted_at)) / 36e5;
    if (Number.isFinite(h) && h >= 0) {
      const arr = hoursByProfile.get(p.participant_profile_id) ?? [];
      arr.push(h);
      hoursByProfile.set(p.participant_profile_id, arr);
    }
  }

  const profMeta = new Map<string, { username: string | null; display_name: string | null }>();
  profileIds = [...byProfile.keys()];
  for (let i = 0; i < profileIds.length; i += 100) {
    const { data: pr } = await service
      .from("profiles")
      .select("id, username, display_name")
      .in("id", profileIds.slice(i, i + 100));
    for (const r of pr ?? []) {
      const row = r as { id: string; username: string | null; display_name: string | null };
      profMeta.set(row.id, { username: row.username, display_name: row.display_name });
    }
  }

  const rowsUncut: OpsCreatorSummaryRow[] = [];
  for (const [profile_id, agg] of byProfile) {
    const ss = submissionStats.get(profile_id) ?? { total: 0, approved: 0 };
    const hrs = hoursByProfile.get(profile_id);
    let avgHoursAcceptToFirstSubmit: number | null = null;
    if (hrs && hrs.length > 0) {
      avgHoursAcceptToFirstSubmit = hrs.reduce((a, b) => a + b, 0) / hrs.length;
    }
    const meta = profMeta.get(profile_id);
    rowsUncut.push({
      profile_id,
      username: meta?.username ?? null,
      display_name: meta?.display_name ?? null,
      campaigns_joined: agg.campaigns.size,
      participant_accepted: agg.accepted,
      submissions: ss.total,
      approved_submissions: ss.approved,
      avgHoursAcceptToFirstSubmit,
    });
  }

  rowsUncut.sort((a, b) => b.submissions - a.submissions || b.campaigns_joined - a.campaigns_joined);

  const sliced = rowsUncut.slice(opts.offset, opts.offset + opts.limit);
  return { rows: sliced, truncated, scannedParticipants: parts.length };
}

export type OpsCreatorDetailReport = {
  profile: { id: string; username: string | null; display_name: string | null; email: string | null; profile_type: string | null };
  personal_plan: PlanKey;
  participant_rows: Array<{
    campaign_id: string;
    campaign_title: string | null;
    status: string;
    invited_at: string;
    accepted_at: string | null;
  }>;
  submissions: Array<{
    id: string;
    campaign_id: string;
    campaign_title: string | null;
    status: string;
    platform: string;
    created_at: string;
  }>;
  stats: {
    campaigns_distinct: number;
    accepted_participations: number;
    submissions: number;
    approved: number;
    avgHoursAcceptToFirstSubmit: number | null;
  };
  truncated: boolean;
};

export async function fetchOpsCreatorDetailReport(
  service: SupabaseClient,
  profileId: string
): Promise<OpsCreatorDetailReport | null> {
  const { data: profile } = await service
    .from("profiles")
    .select("id, username, display_name, email, profile_type")
    .eq("id", profileId)
    .maybeSingle();
  if (!profile) return null;

  const { data: sub } = await service
    .from("subscriptions")
    .select("plan_key, tier, status, current_period_end")
    .eq("owner_type", "profile")
    .eq("owner_id", profileId)
    .eq("status", "active")
    .maybeSingle();
  const personal_plan = sub
    ? planKeyFromSubscriptionRow(sub as SubscriptionPlanInput)
    : ("free" as PlanKey);

  const participant_rows: OpsCreatorDetailReport["participant_rows"] = [];
  let truncated = false;
  let pStart = 0;
  while (pStart < MAX_SCAN_ROWS) {
    const { data } = await service
      .from("crm_campaign_participants")
      .select("campaign_id, status, invited_at, accepted_at")
      .eq("participant_profile_id", profileId)
      .order("invited_at", { ascending: false })
      .range(pStart, pStart + PAGE - 1);
    const batch = (data ?? []) as Array<{
      campaign_id: string;
      status: string;
      invited_at: string;
      accepted_at: string | null;
    }>;
    if (batch.length === 0) break;
    participant_rows.push(...batch.map((b) => ({ ...b, campaign_title: null as string | null })));
    pStart += batch.length;
    if (batch.length < PAGE) break;
  }
  if (pStart >= MAX_SCAN_ROWS) truncated = true;

  const campIds = [...new Set(participant_rows.map((r) => r.campaign_id))];
  const titles = new Map<string, string>();
  for (let i = 0; i < campIds.length; i += 120) {
    const { data: camps } = await service.from("crm_campaigns").select("id, title").in("id", campIds.slice(i, i + 120));
    for (const c of camps ?? []) titles.set((c as { id: string }).id, (c as { title: string }).title);
  }
  for (const r of participant_rows) {
    r.campaign_title = titles.get(r.campaign_id) ?? null;
  }

  const submissions: OpsCreatorDetailReport["submissions"] = [];
  let sStart = 0;
  while (sStart < MAX_SCAN_ROWS) {
    const { data } = await service
      .from("crm_submissions")
      .select("id, campaign_id, status, platform, created_at")
      .eq("participant_profile_id", profileId)
      .order("created_at", { ascending: false })
      .range(sStart, sStart + PAGE - 1);
    const batch = (data ?? []) as Array<{
      id: string;
      campaign_id: string;
      status: string;
      platform: string;
      created_at: string;
    }>;
    if (batch.length === 0) break;
    submissions.push(
      ...batch.map((b) => ({
        ...b,
        campaign_title: titles.get(b.campaign_id) ?? null,
      }))
    );
    sStart += batch.length;
    if (batch.length < PAGE) break;
  }
  if (sStart >= MAX_SCAN_ROWS) truncated = true;

  const campaigns_distinct = new Set(participant_rows.map((r) => r.campaign_id)).size;
  const accepted_participations = participant_rows.filter((r) => r.status === "accepted").length;
  const approved = submissions.filter((s) => s.status === "approved").length;

  const firstByCampaign = new Map<string, string>();
  for (const s of submissions) {
    const prev = firstByCampaign.get(s.campaign_id);
    if (!prev || s.created_at < prev) firstByCampaign.set(s.campaign_id, s.created_at);
  }
  const hours: number[] = [];
  for (const r of participant_rows) {
    if (r.status !== "accepted" || !r.accepted_at) continue;
    const first = firstByCampaign.get(r.campaign_id);
    if (!first) continue;
    const h = (Date.parse(first) - Date.parse(r.accepted_at)) / 36e5;
    if (Number.isFinite(h) && h >= 0) hours.push(h);
  }
  const avgHoursAcceptToFirstSubmit =
    hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : null;

  return {
    profile: profile as OpsCreatorDetailReport["profile"],
    personal_plan,
    participant_rows,
    submissions,
    stats: {
      campaigns_distinct,
      accepted_participations,
      submissions: submissions.length,
      approved,
      avgHoursAcceptToFirstSubmit,
    },
    truncated,
  };
}

export type OpsPlatformExtraCounts = {
  campaignsCompleted: number | null;
  submissionsTotal: number | null;
  submissionsApproved: number | null;
  submissionsRejected: number | null;
  submissionsNeedsRevision: number | null;
  submissionsPending: number | null;
  workspacesTotal: number | null;
};

export async function fetchOpsPlatformExtraCounts(service: SupabaseClient): Promise<OpsPlatformExtraCounts> {
  const [
    { count: campaignsCompleted },
    { count: submissionsTotal },
    { count: submissionsApproved },
    { count: submissionsRejected },
    { count: submissionsNeedsRevision },
    { count: submissionsPending },
    { count: workspacesTotal },
  ] = await Promise.all([
    service.from("crm_campaigns").select("*", { count: "exact", head: true }).eq("status", "completed"),
    service.from("crm_submissions").select("*", { count: "exact", head: true }),
    service.from("crm_submissions").select("*", { count: "exact", head: true }).eq("status", "approved"),
    service.from("crm_submissions").select("*", { count: "exact", head: true }).eq("status", "rejected"),
    service.from("crm_submissions").select("*", { count: "exact", head: true }).eq("status", "needs_revision"),
    service.from("crm_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
    service.from("crm_workspaces").select("*", { count: "exact", head: true }),
  ]);

  return {
    campaignsCompleted,
    submissionsTotal,
    submissionsApproved,
    submissionsRejected,
    submissionsNeedsRevision,
    submissionsPending,
    workspacesTotal,
  };
}

export type OpsEntitlementExportRow = {
  id: string;
  subject_type: string;
  subject_id: string;
  kind: string;
  expires_at: string;
  revoked_at: string | null;
  reason: string;
  created_at: string;
};

export async function fetchOpsEntitlementsForTable(
  service: SupabaseClient,
  opts: { kind: string | null; state: "all" | "active" | "revoked"; limit: number; offset: number }
): Promise<{ rows: OpsEntitlementExportRow[]; total: number | null }> {
  const nowIso = new Date().toISOString();
  let q = service.from("platform_ops_entitlements").select("*", { count: "exact" });
  if (opts.kind) q = q.eq("kind", opts.kind);
  if (opts.state === "active") {
    q = q.is("revoked_at", null).gt("expires_at", nowIso);
  } else if (opts.state === "revoked") {
    q = q.not("revoked_at", "is", null);
  }
  q = q.order("created_at", { ascending: false }).range(opts.offset, opts.offset + opts.limit - 1);
  const { data, count } = await q;
  const rows = (data ?? []) as OpsEntitlementExportRow[];
  return { rows, total: count };
}

export type OpsGrowthWindowCounts = {
  profilesNew: number | null;
  orgsNew: number | null;
  campaignsNew: number | null;
  workspacesNew: number | null;
  submissionsNew: number | null;
};

export async function fetchOpsGrowthInWindow(
  service: SupabaseClient,
  fromIso: string,
  toIso: string
): Promise<OpsGrowthWindowCounts> {
  const [
    { count: profilesNew },
    { count: orgsNew },
    { count: campaignsNew },
    { count: workspacesNew },
    { count: submissionsNew },
  ] = await Promise.all([
    service.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    service.from("orgs").select("*", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    service.from("crm_campaigns").select("*", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    service.from("crm_workspaces").select("*", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
    service.from("crm_submissions").select("*", { count: "exact", head: true }).gte("created_at", fromIso).lte("created_at", toIso),
  ]);

  return { profilesNew, orgsNew, campaignsNew, workspacesNew, submissionsNew };
}

export async function fetchOpsAuditActionHistogram(
  service: SupabaseClient,
  opts: { fromIso: string | null; toIso: string | null }
): Promise<{ counts: Record<string, number>; scanned: number; truncated: boolean }> {
  const counts: Record<string, number> = {};
  let start = 0;
  let truncated = false;
  while (start < MAX_SCAN_ROWS) {
    let q = service.from("platform_audit_log").select("action").range(start, start + PAGE - 1);
    if (opts.fromIso) q = q.gte("created_at", opts.fromIso);
    if (opts.toIso) q = q.lte("created_at", opts.toIso);
    const { data } = await q;
    const batch = (data ?? []) as { action: string }[];
    if (batch.length === 0) break;
    for (const r of batch) {
      counts[r.action] = (counts[r.action] ?? 0) + 1;
    }
    start += batch.length;
    if (batch.length < PAGE) break;
  }
  if (start >= MAX_SCAN_ROWS) truncated = true;
  return { counts, scanned: start, truncated };
}
