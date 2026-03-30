/**
 * Builds rich analytics card headers from existing window KPIs only (no new fetches).
 */
import type { AnalyticsRichChartCardProps } from "./AnalyticsRichChartCard";
import type { FollowerNetEndpointSource } from "@/lib/xAnalyticsPayloadBuild";
import {
  coverageConfidenceLabel,
  engagementSignal,
  followerSignal,
  followerWindowNarrative,
  formatSignedInt,
  netFollowerDeltaFromSeries,
  pctChangeVsPrior,
  postingSignal,
  priorEngagementRatePct,
} from "@/lib/analyticsChartMetrics";

function followerEndpointInsightAppend(
  src: FollowerNetEndpointSource | null | undefined,
  snapshotDay: string | null | undefined
): string {
  if (src === "post_window_snapshot" && snapshotDay) {
    return ` End level uses the stored daily snapshot on ${snapshotDay} (first reading after this UTC window).`;
  }
  if (src === "profile_followers_total") {
    return " End level uses your stored profile follower total (from the last X profile sync in our data), because this window has no daily follower rows in our tables.";
  }
  return "";
}

export type WindowMeta = { start: string; end: string; days: number };

export type EngagementRichParams = {
  window: WindowMeta;
  activeDaysWithPosts: number;
  kpis: {
    engagement_pct_avg: number;
    posts_total: number;
    prior_engagements_total?: number;
    prior_potential_reach?: number;
  };
  lowVariance: boolean;
};

export function buildEngagementRichHeader(p: EngagementRichParams): Omit<AnalyticsRichChartCardProps, "children"> {
  const { kpis, window, activeDaysWithPosts, lowVariance } = p;
  const posts = Number(kpis.posts_total) || 0;
  const cur = Number(kpis.engagement_pct_avg) || 0;
  const priorRate = priorEngagementRatePct(kpis);
  const delta = posts > 0 ? pctChangeVsPrior(cur, priorRate) : null;
  const signal = engagementSignal(delta, cur);
  const cov = `${activeDaysWithPosts} / ${window.days} days active`;
  const conf = coverageConfidenceLabel(activeDaysWithPosts, window.days);

  return {
    title: "Engagement Rate",
    windowRangeLabel: `${window.start} → ${window.end} · UTC`,
    primaryLabel: "Avg engagement rate (window)",
    primaryValue: posts > 0 ? cur.toFixed(1) : "—",
    primarySuffix: posts > 0 ? "%" : undefined,
    deltaVsPriorPct: priorRate != null && posts > 0 ? delta : null,
    showPriorDelta: true,
    signal,
    coverageBadge: cov,
    bucketHint: "Daily buckets",
    insight:
      posts === 0
        ? "No posts in this window — rate compares impressions to engagements on stored posts only."
        : `Weighted by impressions on posts in this window. ${conf}.`,
    lowVarianceNote: lowVariance && posts > 0,
  };
}

export type PostingRichParams = {
  window: WindowMeta;
  activePostingDays: number;
  postsTotal: number;
  priorPosts: number;
  lowVariance: boolean;
};

export function buildPostingRichHeader(p: PostingRichParams): Omit<AnalyticsRichChartCardProps, "children"> {
  const prior = Number(p.priorPosts) || 0;
  const cur = Number(p.postsTotal) || 0;
  const delta = pctChangeVsPrior(cur, prior > 0 ? prior : null);
  const signal = postingSignal(delta, cur);
  const cov = `${p.activePostingDays} / ${p.window.days} days with posts`;

  return {
    title: "Posting Cadence",
    windowRangeLabel: `${p.window.start} → ${p.window.end} · UTC`,
    primaryLabel: "Posts in window",
    primaryValue: `${cur}`,
    primarySuffix: cur === 1 ? " post" : " posts",
    deltaVsPriorPct: prior > 0 ? delta : null,
    showPriorDelta: true,
    signal,
    coverageBadge: cov,
    bucketHint: "Daily buckets",
    insight:
      cur === 0
        ? "Bars show how often you posted each UTC day once X sync has tweet rows."
        : "Taller bars are heavier posting days; compare to the prior window for consistency.",
    lowVarianceNote: p.lowVariance && cur > 0,
  };
}

export type FollowerRichParams = {
  window: WindowMeta;
  coverageDays: number;
  points: ReadonlyArray<{ follower_delta: number | null }>;
  earliestDate?: string | null;
  baselineDay?: string | null;
  hasPreWindowBaseline?: boolean;
  netEndpointSource?: FollowerNetEndpointSource | null;
  netEndpointSnapshotDay?: string | null;
  mode: "ok" | "insufficient" | "empty";
  insufficientHasPartial?: boolean;
};

export function buildFollowerRichHeader(p: FollowerRichParams): Omit<AnalyticsRichChartCardProps, "children"> {
  const baseRange = `${p.window.start} → ${p.window.end} · UTC`;
  const cov = `${p.coverageDays} / ${p.window.days} days captured`;

  if (p.mode === "insufficient") {
    return {
      title: "Follower Growth",
      windowRangeLabel: baseRange,
      primaryLabel: "Net change (window)",
      primaryValue: "—",
      primarySuffix: undefined,
      deltaVsPriorPct: null,
      showPriorDelta: false,
      signal: "watch",
      coverageBadge: cov,
      bucketHint: "Daily buckets",
      insight: p.insufficientHasPartial
        ? p.coverageDays === 1 && p.window.days > 1 && !p.hasPreWindowBaseline
          ? "Only one day in this UTC window has a stored follower total, and there is no earlier daily snapshot in Linkary to use as a start level — we do not infer net change for the full window from that alone."
          : p.earliestDate
            ? `Earliest snapshot shown here starts ${p.earliestDate}. Stored follower coverage for this window is still limited.`
            : "Stored follower history for this window is still limited."
        : "No stored daily follower totals in Linkary for this window yet.",
      lowVarianceNote: false,
    };
  }

  if (p.mode === "empty") {
    return {
      title: "Follower Growth",
      windowRangeLabel: baseRange,
      primaryLabel: "Net change (window)",
      primaryValue: "—",
      primarySuffix: undefined,
      deltaVsPriorPct: null,
      showPriorDelta: false,
      signal: "watch",
      coverageBadge: cov,
      bucketHint: "Daily buckets",
      insight:
        "No stored daily follower totals in this UTC window. Tweet-based charts may still show if posts were synced.",
      lowVarianceNote: false,
    };
  }

  const net = netFollowerDeltaFromSeries(p.points);
  const signal = followerSignal(net, p.coverageDays, p.window.days);

  return {
    title: "Follower Growth",
    windowRangeLabel: baseRange,
    primaryLabel: "Net followers (snapshot deltas)",
    primaryValue: formatSignedInt(net),
    primarySuffix: undefined,
    deltaVsPriorPct: null,
    showPriorDelta: false,
    signal,
    coverageBadge: cov,
    bucketHint: "Daily UTC buckets",
    insight: (() => {
      const base = p.earliestDate
        ? `${followerWindowNarrative(net, p.coverageDays, p.window.days)} First in-window snapshot day: ${p.earliestDate}.`
        : followerWindowNarrative(net, p.coverageDays, p.window.days);
      const anchor =
        p.baselineDay && p.hasPreWindowBaseline
          ? ` Start-of-window level comes from the stored snapshot on ${p.baselineDay}.`
          : "";
      return `${base}${anchor}${followerEndpointInsightAppend(p.netEndpointSource, p.netEndpointSnapshotDay)}`;
    })(),
    lowVarianceNote: false,
  };
}
