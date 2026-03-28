"use client";

import React, { useMemo } from "react";
import { PATH_INTEGRATIONS } from "@/lib/analytics-owner-state-presentation";
import { AnalyticsRichChartCard } from "./AnalyticsRichChartCard";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { buildPostingRichHeader, type WindowMeta } from "./richHeaderFromPayload";

const CHART_H = 200;

export interface PostingCadenceChartProps {
  points: Array<{ date: string; posts: number }>;
  activePostingDays?: number;
  tweetCountWindow?: number;
  windowDays?: number;
  noPostsInPeriod: boolean;
  insufficientForTrend: boolean;
  bucketLabel?: "Daily" | "Weekly";
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  useRichShell?: boolean;
  windowMeta?: WindowMeta;
  priorPostsTotal?: number;
}

function Shell(props: {
  rich: Omit<import("./AnalyticsRichChartCard").AnalyticsRichChartCardProps, "children"> | null;
  useRich: boolean;
  legacyCoverage?: string;
  bucketLabel?: "Daily" | "Weekly";
  lowVariance?: boolean;
  children: React.ReactNode;
}) {
  if (props.useRich && props.rich) {
    return (
      <AnalyticsRichChartCard {...props.rich} lowVarianceNote={props.rich.lowVarianceNote}>
        {props.children}
      </AnalyticsRichChartCard>
    );
  }
  return (
    <ChartCard title="Posting Cadence" coverage={props.legacyCoverage} bucketLabel={props.bucketLabel} lowVariance={props.lowVariance}>
      {props.children}
    </ChartCard>
  );
}

export function PostingCadenceChart({
  points,
  activePostingDays,
  tweetCountWindow,
  windowDays,
  noPostsInPeriod,
  insufficientForTrend,
  bucketLabel,
  onRefresh,
  refreshDisabled,
  useRichShell,
  windowMeta,
  priorPostsTotal,
}: PostingCadenceChartProps) {
  const { maxPosts, lowVariance } = useMemo(() => {
    const vals = points.map((p) => Number(p.posts) || 0);
    const max = vals.length ? Math.max(1, ...vals) : 1;
    const min = vals.length ? Math.min(...vals) : 0;
    return { maxPosts: max, lowVariance: max - min <= 1 && vals.length > 0 };
  }, [points]);

  const coverage = useMemo(() => {
    const parts: string[] = [];
    if (activePostingDays != null && windowDays != null) {
      parts.push(`${activePostingDays}/${windowDays}d`);
    }
    if (tweetCountWindow != null) {
      parts.push(`${tweetCountWindow} posts`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [activePostingDays, windowDays, tweetCountWindow]);

  const hasAnyData = points.length > 0 && points.some((p) => (Number(p.posts) || 0) > 0);
  const integrationsHref = PATH_INTEGRATIONS;
  const useRich = !!(useRichShell && windowMeta);
  const postsCur = tweetCountWindow ?? 0;
  const postsPrior = priorPostsTotal ?? 0;

  const baseRich = useMemo(() => {
    if (!useRich || !windowMeta) return null;
    return buildPostingRichHeader({
      window: windowMeta,
      activePostingDays: activePostingDays ?? 0,
      postsTotal: postsCur,
      priorPosts: postsPrior,
      lowVariance,
    });
  }, [useRich, windowMeta, activePostingDays, postsCur, postsPrior, lowVariance]);

  if (noPostsInPeriod) {
    const rich =
      baseRich &&
      ({
        ...baseRich,
        primaryValue: "0",
        primarySuffix: " posts",
        deltaVsPriorPct: postsPrior > 0 ? ((0 - postsPrior) / postsPrior) * 100 : null,
        insight: "No posts in this UTC window — cadence bars need tweets on those dates.",
        lowVarianceNote: false,
      } as const);
    return (
      <Shell useRich={useRich} rich={rich ?? null} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No posts in this window."
          secondary="Post on X to unlock trends."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  if (insufficientForTrend) {
    return (
      <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Not enough data for trend yet."
          secondary={
            tweetCountWindow != null && windowDays != null
              ? `${tweetCountWindow} posts in ${windowDays}d. Need more activity.`
              : "Need more posts to show trend."
          }
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No data in this period."
          secondary="Connect X in Integrations to sync."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  const MIN_POINTS_FOR_TREND = 3;
  if (points.length < MIN_POINTS_FOR_TREND) {
    return (
      <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Need at least 3 data points to show trend."
          secondary={coverage ? `${coverage} in window.` : "More posts will fill the chart."}
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  const barAreaHeight = CHART_H - 32;
  const minBarHeightPct = (4 / barAreaHeight) * 100;
  const denseWindow = points.length > 14;
  const barTrackMinWidthPx = denseWindow ? points.length * 10 : undefined;

  const chart = (
    <div className="rounded-lg border border-border/50 bg-background/80 px-2 py-2 shadow-inner">
      <div className="relative border-l border-b border-border/70 pl-7 pb-6 pt-2 w-full" style={{ height: CHART_H }}>
        <div className="absolute left-1 top-2 text-[10px] font-medium text-muted-foreground tabular-nums">{maxPosts}</div>
        <div className="absolute left-1 bottom-6 text-[10px] font-medium text-muted-foreground tabular-nums">0</div>
        <div className={`pl-0 w-full ${denseWindow ? "overflow-x-auto overflow-y-hidden" : ""}`} style={{ height: barAreaHeight }}>
          <div
            className="flex h-full items-stretch gap-px pl-0 w-full"
            style={barTrackMinWidthPx ? { minWidth: barTrackMinWidthPx } : undefined}
          >
            {points.map((p, i) => {
              const posts = Number(p.posts) || 0;
              const heightPct = maxPosts > 0 && posts > 0 ? Math.max(minBarHeightPct, (posts / maxPosts) * 100) : 0;
              return (
                <div
                  key={`${p.date}-${i}`}
                  className="flex min-h-0 min-w-0 flex-1 flex-col justify-end"
                  title={`${p.date}: ${posts} posts`}
                >
                  {heightPct > 0 ? (
                    <div
                      className="w-full rounded-t-sm border-t-2 bg-primary border-primary/50 shadow-sm transition-all"
                      style={{ height: `${heightPct}%`, minHeight: 4 }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-2.5 px-1 tabular-nums">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );

  return (
    <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel} lowVariance={lowVariance}>
      {chart}
    </Shell>
  );
}
