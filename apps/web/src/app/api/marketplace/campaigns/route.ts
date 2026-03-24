import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

type CampaignStatusUi = "upcoming" | "active" | "ending_soon" | "closed";

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function daysLeft(endIso: string | null): number | null {
  if (!endIso) return null;
  const now = new Date();
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) return null;
  const diffMs = end.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

function deriveStatus(opts: {
  campaignStatus: string | null;
  startsAt: string | null;
  endsAt: string | null;
}): CampaignStatusUi {
  const now = Date.now();
  const startsMs = opts.startsAt ? new Date(opts.startsAt).getTime() : null;
  const endsMs = opts.endsAt ? new Date(opts.endsAt).getTime() : null;
  const raw = (opts.campaignStatus ?? "").toLowerCase();
  if (raw === "completed" || raw === "cancelled" || raw === "paused") return "closed";
  if (endsMs != null && Number.isFinite(endsMs) && endsMs < now) return "closed";
  if (startsMs != null && Number.isFinite(startsMs) && startsMs > now) return "upcoming";
  const left = daysLeft(opts.endsAt);
  if (left != null && left >= 0 && left <= 7) return "ending_soon";
  return "active";
}

export async function GET(_request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ campaigns: [] });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: rows, error } = await supabase
    .from("crm_campaigns")
    .select("id,workspace_id,source_linkary_campaign_id,title,description,starts_at,ends_at,budget,campaign_value_usd,status,created_at,promoted_org_id")
    .not("source_linkary_campaign_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(150);

  if (error || !Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ campaigns: [] });
  }

  const workspaceIds = [...new Set(rows.map((r) => r.workspace_id).filter(Boolean))];
  const linkaryIds = [...new Set(rows.map((r) => String(r.source_linkary_campaign_id ?? "")).filter(Boolean))];
  const promotedOrgIds = [...new Set(rows.map((r) => r.promoted_org_id).filter(Boolean))];

  const [{ data: workspaces }, { data: jobs }, { data: participants }, { data: metrics }, { data: promotedOrgs }, { data: invites }] = await Promise.all([
    workspaceIds.length
      ? supabase.from("crm_workspaces").select("id,linked_org_id,name").in("id", workspaceIds)
      : Promise.resolve({ data: [] as Array<{ id: string; linked_org_id: string | null; name: string }> }),
    linkaryIds.length
      ? supabase.from("jobs").select("id,org_id,status").in("id", linkaryIds)
      : Promise.resolve({ data: [] as Array<{ id: string; org_id: string; status: string }> }),
    rows.length
      ? supabase.from("crm_campaign_participants").select("campaign_id,id")
      : Promise.resolve({ data: [] as Array<{ campaign_id: string; id: string }> }),
    rows.length
      ? supabase
          .from("crm_campaign_metrics_daily")
          .select("campaign_id,day,total_contributors")
          .in("campaign_id", rows.map((r) => r.id))
          .order("day", { ascending: true })
      : Promise.resolve({ data: [] as Array<{ campaign_id: string; day: string; total_contributors: number | null }> }),
    promotedOrgIds.length
      ? supabase.from("orgs").select("id,name,slug").in("id", promotedOrgIds)
      : Promise.resolve({ data: [] as Array<{ id: string; name: string; slug: string }> }),
    linkaryIds.length
      ? supabase.from("org_job_invites").select("job_id,id").in("job_id", linkaryIds)
      : Promise.resolve({ data: [] as Array<{ job_id: string; id: string }> }),
  ]);

  const workspaceMap = new Map((workspaces ?? []).map((w) => [w.id, w]));
  const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));
  const orgIdsFromJobs = [...new Set((jobs ?? []).map((j) => j.org_id).filter(Boolean))];
  const { data: jobOrgs } = orgIdsFromJobs.length
    ? await supabase.from("orgs").select("id,name,slug").in("id", orgIdsFromJobs)
    : { data: [] as Array<{ id: string; name: string; slug: string }> };
  const orgMap = new Map((jobOrgs ?? []).map((o) => [o.id, o]));
  const promotedOrgMap = new Map((promotedOrgs ?? []).map((o) => [o.id, o]));
  const participantCount = new Map<string, number>();
  for (const p of participants ?? []) {
    participantCount.set(p.campaign_id, (participantCount.get(p.campaign_id) ?? 0) + 1);
  }
  const metricsMap = new Map<string, Array<{ day: string; contributors: number }>>();
  for (const m of metrics ?? []) {
    const bucket = metricsMap.get(m.campaign_id) ?? [];
    bucket.push({ day: m.day, contributors: Number(m.total_contributors) || 0 });
    metricsMap.set(m.campaign_id, bucket);
  }
  const inviteCountByJob = new Map<string, number>();
  for (const inv of invites ?? []) {
    inviteCountByJob.set(inv.job_id, (inviteCountByJob.get(inv.job_id) ?? 0) + 1);
  }

  const campaigns = rows.map((r) => {
    const job = jobMap.get(String(r.source_linkary_campaign_id ?? ""));
    const org = (job?.org_id && orgMap.get(job.org_id)) || (r.promoted_org_id && promotedOrgMap.get(r.promoted_org_id)) || null;
    const startsAt = toIsoDate(r.starts_at);
    const endsAt = toIsoDate(r.ends_at);
    const status = deriveStatus({ campaignStatus: r.status, startsAt, endsAt });
    const left = daysLeft(endsAt);
    const series = (metricsMap.get(r.id) ?? []).slice(-14);
    const trendDelta =
      series.length >= 2 ? series[series.length - 1].contributors - series[Math.max(0, series.length - 8)].contributors : null;
    const jobStatus = (job?.status ?? "").toLowerCase();
    const inviteCount = job?.id ? inviteCountByJob.get(job.id) ?? 0 : 0;
    const visibility = inviteCount > 0 ? "invite_only" : "public";
    const acceptsNewUsers = jobStatus === "open";
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? null,
      campaign_type: job?.id ? "campaign" : "creator_program",
      org: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      starts_at: startsAt,
      ends_at: endsAt,
      days_left: left,
      status,
      status_raw: r.status,
      value_usd: r.campaign_value_usd != null ? Number(r.campaign_value_usd) : r.budget != null ? Number(r.budget) : null,
      participant_count: participantCount.get(r.id) ?? 0,
      visibility,
      capacity_info: inviteCount > 0 ? `${inviteCount} invited` : null,
      accepts_new_users: acceptsNewUsers,
      source_job_status: job?.status ?? null,
      trend: series.length >= 2 ? { delta_7d: trendDelta, series } : null,
      workspace_name: workspaceMap.get(r.workspace_id)?.name ?? null,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ campaigns });
}
