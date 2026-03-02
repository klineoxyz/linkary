"use client";

import React, { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";

const CHART_H = 180;

export interface PostingCadenceChartProps {
  points: Array<{ date: string; posts: number }>;
  tweetCountWindow?: number;
  windowDays?: number;
  noPostsInPeriod: boolean;
  insufficientForTrend: boolean;
  summaryMessage?: string;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function PostingCadenceChart({
  points,
  tweetCountWindow,
  windowDays,
  noPostsInPeriod,
  insufficientForTrend,
  summaryMessage,
  onRefresh,
  refreshDisabled,
}: PostingCadenceChartProps) {
  const { maxPosts, lowVariance } = useMemo(() => {
    const vals = points.map((p) => p.posts ?? 0);
    const max = vals.length ? Math.max(1, ...vals) : 1;
    const min = vals.length ? Math.min(...vals) : 0;
    return { maxPosts: max, lowVariance: max - min <= 1 && vals.length > 0 };
  }, [points]);

  const hasAnyData = points.length > 0 && points.some((p) => (p.posts ?? 0) > 0);
  const coverage = tweetCountWindow != null ? `${tweetCountWindow} posts` : undefined;

  const integrationsHref = "/settings/integrations";

  if (noPostsInPeriod) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage}>
        <EmptyState
          message="No posts in the selected period."
          secondary="Post to see cadence."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  if (insufficientForTrend) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage}>
        <EmptyState
          message="Not enough data for trend yet."
          secondary={tweetCountWindow != null && windowDays != null ? `${tweetCountWindow} posts in ${windowDays}d. Need more activity.` : "Need more posts to show trend."}
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage}>
        <EmptyState
          message="No data in this period."
          secondary="Connect X in Integrations to sync."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Posting Cadence" coverage={coverage} lowVariance={lowVariance}>
      <div className="relative border-l border-b border-border pl-6 pb-5 pt-1" style={{ minHeight: CHART_H }}>
        <div className="absolute left-0 top-1 text-[10px] text-muted-foreground tabular-nums">{maxPosts}</div>
        <div className="absolute left-0 bottom-5 text-[10px] text-muted-foreground tabular-nums">0</div>
        <div className="flex items-end gap-0.5 pl-0" style={{ minHeight: CHART_H - 28 }}>
          {points.map((p, i) => {
            const posts = p.posts ?? 0;
            const heightPct = maxPosts > 0 ? Math.max(1, (posts / maxPosts) * 100) : 0;
            return (
              <div
                key={`${p.date}-${i}`}
                className="flex-1 min-w-[6px] max-w-[12px] rounded-t border-t bg-primary/80 border-primary/50 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${p.date}: ${posts} posts`}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-0.5 tabular-nums">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </ChartCard>
  );
}
