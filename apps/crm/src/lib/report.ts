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
  getCampaignTopContributorsByApprovedSubmissions,
  type CampaignRow,
  type CampaignSubmissionRow,
  type TopContributor,
} from "@/lib/campaigns";
import { getAccountGrowth, getEndSnapshotStatus, type AccountGrowth, type EndSnapshotStatus } from "@/lib/snapshots";
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

/** Leaderboard by weighted task completion (approved + done); not X engagement. */
export type ContributionRankRow = {
  participant_profile_id: string;
  contribution_percent: number;
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
  /** Enrolled participants (all statuses) from crm_campaign_participants — not promoted-account metrics. */
  participant_enrolled_count: number;
  top_contributors_all_submissions: TopContributorWithContribution[];
  top_contributors_approved_submissions: TopContributorWithContribution[];
  top_by_contribution_percent: ContributionRankRow[];
  contribution_rows: ContributionRow[];
  submissions: CampaignSubmissionRow[];
  chart_series: ReportChartPoint[];
  account_growth: AccountGrowth[];
  has_metrics: boolean;
  finalized_at: string | null;
  /** End snapshot coverage for promoted_social_handles; used for finalize safety and report completeness. */
  end_snapshot_status: EndSnapshotStatus;
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
  const promotedHandles = campaign.promoted_social_handles ?? [];
  const [kpis, submissions, topAllSubs, topApprovedSubs, dailyRows, contributionRows, accountGrowth, endSnapshotStatus] =
    await Promise.all([
      getCampaignKpis(supabase, campaignId, {
        budget: campaign.budget,
        currency: campaign.currency,
      }),
      getCampaignSubmissions(supabase, campaignId),
      getCampaignTopContributors(supabase, campaignId),
      getCampaignTopContributorsByApprovedSubmissions(supabase, campaignId),
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
      getEndSnapshotStatus(supabase, campaignId, promotedHandles),
    ]);

  const contributionByProfile = new Map(
    contributionRows.map((r) => [r.participant_profile_id, r.contributionPercent])
  );
  const mergeContribution = (list: TopContributor[]): TopContributorWithContribution[] =>
    list.map((t) => ({
      ...t,
      contribution_percent: contributionByProfile.get(t.participant_profile_id) ?? null,
    }));

  const top_contributors_all_submissions = mergeContribution(topAllSubs);
  const top_contributors_approved_submissions = mergeContribution(topApprovedSubs);

  const top_by_contribution_percent: ContributionRankRow[] = [...contributionRows]
    .sort((a, b) => b.contributionPercent - a.contributionPercent)
    .slice(0, 10)
    .map((r) => ({
      participant_profile_id: r.participant_profile_id,
      contribution_percent: r.contributionPercent,
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
    participant_enrolled_count: kpis.total_contributors,
    top_contributors_all_submissions,
    top_contributors_approved_submissions,
    top_by_contribution_percent,
    contribution_rows: contributionRows,
    submissions,
    chart_series,
    account_growth: accountGrowth,
    has_metrics: kpis.has_metrics,
    finalized_at: campaign.finalized_at ?? null,
    end_snapshot_status: endSnapshotStatus,
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
  rows.push({
    section: "overview",
    label: "End snapshots (promoted accounts)",
    value: `${data.end_snapshot_status.endSnapshotCount}/${data.end_snapshot_status.promotedCount}`,
  });

  rows.push({
    section: "promoted_account_daily",
    label: "Total posts (promoted account tweets, campaign window)",
    value: data.total_posts,
  });
  rows.push({
    section: "promoted_account_daily",
    label: "Total views/impressions (promoted account tweets)",
    value: data.total_views,
  });
  rows.push({
    section: "promoted_account_daily",
    label: "Total engagements on promoted account tweets",
    value: data.total_engagements,
  });
  rows.push({
    section: "participant_execution",
    label: "Participants enrolled (CRM)",
    value: data.participant_enrolled_count,
  });

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

  for (const t of data.top_contributors_all_submissions) {
    rows.push({
      section: "leaderboard_all_submissions",
      label: `${t.participant_profile_id} proof submissions (all statuses)`,
      value: t.submission_count,
    });
  }
  for (const t of data.top_contributors_approved_submissions) {
    rows.push({
      section: "leaderboard_approved_submissions",
      label: `${t.participant_profile_id} approved proof submissions`,
      value: t.submission_count,
    });
  }
  for (const t of data.top_by_contribution_percent) {
    rows.push({
      section: "leaderboard_task_contribution_pct",
      label: `${t.participant_profile_id} task contribution %`,
      value: t.contribution_percent,
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
