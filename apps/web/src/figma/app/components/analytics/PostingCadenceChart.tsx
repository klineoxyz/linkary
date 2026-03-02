"use client";

import React, { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";

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

  if (noPostsInPeriod) {
    return (
      <ChartCard title="Posting Cadence">
        <EmptyState message="No posts in the selected period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  if (insufficientForTrend && summaryMessage) {
    return (
      <ChartCard title="Posting Cadence">
        <div className="py-6 px-3 text-center">
          <p className="text-sm text-muted-foreground">{summaryMessage}</p>
          {tweetCountWindow != null && windowDays != null && (
            <p className="text-xs text-muted-foreground mt-1">
              Posts in window: {tweetCountWindow} · {windowDays}d
            </p>
          )}
        </div>
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Posting Cadence">
        <EmptyState message="No data in this period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Posting Cadence" coverage={tweetCountWindow != null ? `Posts in window: ${tweetCountWindow}` : undefined}>
      <div className="relative border-l border-b border-border" style={{ minHeight: 160 }}>
        <div className="absolute left-0 top-0 text-[10px] text-muted-foreground -translate-y-0.5">{maxPosts}</div>
        <div className="absolute left-0 bottom-0 text-[10px] text-muted-foreground translate-y-0.5">0</div>
        <div className="flex items-end gap-px pl-5 pb-4 pt-4" style={{ minHeight: 160 }}>
          {points.map((p, i) => {
            const posts = p.posts ?? 0;
            const heightPct = maxPosts > 0 ? Math.max(0.5, (posts / maxPosts) * 100) : 0;
            return (
              <div
                key={`${p.date}-${i}`}
                className="flex-1 min-w-[4px] rounded-t-sm bg-primary/70 border-t border-primary/50 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${p.date}: ${posts} posts`}
              />
            );
          })}
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </ChartCard>
  );
}
