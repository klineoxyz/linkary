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
  const maxPosts = useMemo(() => {
    const vals = points.map((p) => p.posts ?? 0);
    return vals.length ? Math.max(1, ...vals) : 1;
  }, [points]);

  const hasAnyData = points.length > 0 && points.some((p) => (p.posts ?? 0) > 0);
  const coverage = tweetCountWindow != null ? `${tweetCountWindow} posts` : undefined;

  if (noPostsInPeriod) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage}>
        <EmptyState message="No posts in the selected period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  if (insufficientForTrend && summaryMessage) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage}>
        <div className="py-4 px-1">
          <p className="text-sm text-muted-foreground">{summaryMessage}</p>
          {tweetCountWindow != null && windowDays != null && (
            <p className="text-xs text-muted-foreground mt-1">{tweetCountWindow} posts · {windowDays}d</p>
          )}
        </div>
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage}>
        <EmptyState message="No data in this period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Posting Cadence" coverage={coverage}>
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
