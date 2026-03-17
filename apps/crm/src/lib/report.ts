/**
 * CRM: Campaign report data aggregation. Stored data only.
 * Uses promoted_org_id and promoted_social_handles for growth; campaign-level from crm_campaign_metrics_daily.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCampaign,
  getCampaignKpis,
  getCampaignSubmissions,
  getCampaignTopContributors,
  type CampaignRow,
  type CampaignSubmissionRow,
  type TopContributor,
} from "@/lib/campaigns";
import { getAccountGrowth, type AccountGrowth } from "@/lib/snapshots";
import type { ContributionRow } from "@/lib/contribution";
import { computeContribution } from "@/lib/contribution";

export type ReportChartPoint = {
  day: string;
  views: number;
  engagements: number;
  posts: number;
};

export type TopContributorWithContribution = TopContributor & {
  contribution_percent: number | null;
};

export type CampaignReportData = {
  campaign: CampaignRow;
  promoted_org_id: string | null;
  promoted_social_handles: { platform: string; handle: string }[];
  start_date: string | null;
  end_date: string | null;
  reward_date: string | null;
  campaign_value_usd: number | null;
  total_posts: number;
  total_views: number;
  total_engagements: number;
  likes: number | null;
  replies: number | null;
  quotes: number | null;
  reposts: number | null;
  contributor_count: number;
  top_contributors: TopContributorWithContribution[];
  contribution_rows: ContributionRow[];
  submissions: CampaignSubmissionRow[];
  chart_series: ReportChartPoint[];
  account_growth: AccountGrowth[];
  has_metrics: boolean;
  finalized_at: string | null;
};

/**
 * Aggregate all data needed for the campaign final report.
 * Uses stored data only; no fake metrics.
 */
export async function getCampaignReportData(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignReportData | null> {
  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return null;

  const useFinalShare = !!campaign.finalized_at;
  const [kpis, submissions, topContributors, dailyRows, contributionRows, accountGrowth] =
    await Promise.all([
      getCampaignKpis(supabase, campaignId, {
        budget: campaign.budget,
        currency: campaign.currency,
      }),
      getCampaignSubmissions(supabase, campaignId),
      getCampaignTopContributors(supabase, campaignId),
      supabase
        .from("crm_campaign_metrics_daily")
        .select("day, total_views, total_engagements, total_posts")
        .eq("campaign_id", campaignId)
        .order("day", { ascending: true }),
      computeContribution(supabase, campaignId, {
        weighted: true,
        ...(useFinalShare ? { statuses: ["approved"] as const } : {}),
      }),
      getAccountGrowth(supabase, campaignId),
    ]);

  const contributionByProfile = new Map(
    contributionRows.map((r) => [r.participant_profile_id, r.contributionPercent])
  );
  const topWithContribution: TopContributorWithContribution[] = topContributors.map((t) => ({
    ...t,
    contribution_percent: contributionByProfile.get(t.participant_profile_id) ?? null,
  }));

  const daily = (dailyRows?.data ?? []) as {
    day: string;
    total_views?: number;
    total_engagements?: number;
    total_posts?: number;
  }[];
  const chart_series: ReportChartPoint[] = daily.map((d) => ({
    day: d.day,
    views: Number(d.total_views) || 0,
    engagements: Number(d.total_engagements) || 0,
    posts: Number(d.total_posts) || 0,
  }));

  const totalPosts = daily.reduce((s, d) => s + (Number(d.total_posts) || 0), 0);

  let likes: number | null = null;
  let replies: number | null = null;
  let quotes: number | null = null;
  let reposts: number | null = null;
  for (const g of accountGrowth) {
    if (g.end.likes != null) likes = (likes ?? 0) + g.end.likes;
    if (g.end.replies != null) replies = (replies ?? 0) + g.end.replies;
    if (g.end.quotes != null) quotes = (quotes ?? 0) + g.end.quotes;
    if (g.end.reposts != null) reposts = (reposts ?? 0) + g.end.reposts;
  }
  if (likes === null && replies === null && quotes === null && reposts === null) {
    likes = null;
    replies = null;
    quotes = null;
    reposts = null;
  }

  return {
    campaign,
    promoted_org_id: campaign.promoted_org_id ?? null,
    promoted_social_handles: campaign.promoted_social_handles ?? [],
    start_date: campaign.starts_at ?? null,
    end_date: campaign.ends_at ?? null,
    reward_date: campaign.reward_date ?? null,
    campaign_value_usd: campaign.campaign_value_usd != null ? Number(campaign.campaign_value_usd) : null,
    total_posts: totalPosts,
    total_views: kpis.total_views,
    total_engagements: kpis.total_engagements,
    likes,
    replies,
    quotes,
    reposts,
    contributor_count: kpis.total_contributors,
    top_contributors: topWithContribution,
    contribution_rows: contributionRows,
    submissions,
    chart_series,
    account_growth: accountGrowth,
    has_metrics: kpis.has_metrics,
    finalized_at: campaign.finalized_at ?? null,
  };
}

/** Flat rows for CSV/export: section, label, value. No client-only state. */
export type ReportExportRow = { section: string; label: string; value: string | number };

export function reportRowsForExport(data: CampaignReportData): ReportExportRow[] {
  const rows: ReportExportRow[] = [];
  const fmt = (v: string | number | null | undefined) =>
    v == null ? "" : String(v);

  rows.push({ section: "overview", label: "Campaign name", value: data.campaign.title });
  rows.push({ section: "overview", label: "Start date", value: fmt(data.start_date) });
  rows.push({ section: "overview", label: "End date", value: fmt(data.end_date) });
  rows.push({ section: "overview", label: "Finalized at", value: fmt(data.finalized_at) });

  rows.push({ section: "campaign_period", label: "Total posts (campaign-period)", value: data.total_posts });
  rows.push({ section: "campaign_period", label: "Total views (campaign-period)", value: data.total_views });
  rows.push({ section: "campaign_period", label: "Total engagements (campaign-period)", value: data.total_engagements });
  rows.push({ section: "campaign_period", label: "Contributors", value: data.contributor_count });

  rows.push({
    section: "snapshot_totals",
    label: "Likes (from promoted-account end snapshots)",
    value: data.likes ?? "",
  });
  rows.push({
    section: "snapshot_totals",
    label: "Replies (from promoted-account end snapshots)",
    value: data.replies ?? "",
  });
  rows.push({
    section: "snapshot_totals",
    label: "Quotes (from promoted-account end snapshots)",
    value: data.quotes ?? "",
  });
  rows.push({
    section: "snapshot_totals",
    label: "Reposts (from promoted-account end snapshots)",
    value: data.reposts ?? "",
  });

  for (const g of data.account_growth) {
    rows.push({
      section: "growth",
      label: `${g.platform}:${g.handle} follower growth (promoted-account)`,
      value: g.follower_growth ?? "",
    });
    rows.push({
      section: "growth",
      label: `${g.platform}:${g.handle} views growth (promoted-account)`,
      value: g.views_growth ?? "",
    });
    rows.push({
      section: "growth",
      label: `${g.platform}:${g.handle} engagement growth (promoted-account)`,
      value: g.engagement_growth ?? "",
    });
  }

  for (const t of data.top_contributors) {
    rows.push({
      section: "top_contributors",
      label: `${t.participant_profile_id} submissions`,
      value: t.submission_count,
    });
    rows.push({
      section: "top_contributors",
      label: `${t.participant_profile_id} contribution % (final share when campaign finalized)`,
      value: t.contribution_percent ?? "",
    });
  }

  for (const s of data.submissions) {
    rows.push({
      section: "submissions",
      label: `${s.platform}: ${s.url}`,
      value: `${s.status} | ${s.created_at}`,
    });
  }

  return rows;
}
