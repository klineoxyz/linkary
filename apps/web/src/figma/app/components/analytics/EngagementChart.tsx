"use client";

import React, { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";

export interface EngagementChartProps {
  points: Array<{ date: string; engagement_pct: number; posts: number }>;
  coverageDays?: number;
  windowDays?: number;
  tweetCountWindow?: number;
  noPostsInPeriod: boolean;
  insufficientForTrend: boolean;
  summaryMessage?: string;
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function EngagementChart({
  points,
  coverageDays,
  windowDays,
  tweetCountWindow,
  noPostsInPeriod,
  insufficientForTrend,
  summaryMessage,
  onRefresh,
  refreshDisabled,
}: EngagementChartProps) {
  const { max, hasAnyData } = useMemo(() => {
    const vals = points.map((p) => p.engagement_pct).filter((v) => Number.isFinite(v));
    if (vals.length === 0) return { max: 1, hasAnyData: false };
    const m = Math.max(0.01, ...vals);
    return { max: m, hasAnyData: true };
  }, [points]);

  const coverage = coverageDays != null && windowDays != null ? `${coverageDays}/${windowDays} days` : undefined;

  if (noPostsInPeriod) {
    return (
      <ChartCard title="Engagement Rate" coverage={coverage}>
        <EmptyState message="No posts in the selected period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  if (insufficientForTrend && summaryMessage) {
    return (
      <ChartCard title="Engagement Rate" coverage={coverage}>
        <div className="py-6 px-3 text-center">
          <p className="text-sm text-muted-foreground">{summaryMessage}</p>
          {tweetCountWindow != null && <p className="text-xs text-muted-foreground mt-1">Posts in window: {tweetCountWindow}</p>}
        </div>
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Engagement Rate" coverage={coverage}>
        <EmptyState message="No data in this period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Engagement Rate" coverage={coverage}>
      <div className="relative border-l border-b border-border" style={{ minHeight: 160 }}>
        <div className="absolute left-0 top-0 text-[10px] text-muted-foreground -translate-y-0.5">{max.toFixed(1)}%</div>
        <div className="absolute left-0 bottom-0 text-[10px] text-muted-foreground translate-y-0.5">0</div>
        <div className="flex items-end gap-px pl-5 pb-4 pt-4" style={{ minHeight: 160 }}>
          {points.map((p, i) => {
            const val = p.engagement_pct;
            const heightPct = Number.isFinite(val) ? Math.max(0.5, (val / max) * 100) : 0;
            return (
              <div
                key={`${p.date}-${i}`}
                className="flex-1 min-w-[4px] rounded-t-sm bg-primary/70 border-t border-primary/50 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${p.date}: ${Number.isFinite(val) ? `${val.toFixed(1)}%` : "—"}`}
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
