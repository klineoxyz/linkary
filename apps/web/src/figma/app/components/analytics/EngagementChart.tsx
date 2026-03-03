"use client";

import React, { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";

const CHART_H = 180;

export interface EngagementChartProps {
  points: Array<{ date: string; engagement_pct: number; posts: number; is_estimated?: boolean; is_capped?: boolean }>;
  coverageDays?: number;
  windowDays?: number;
  tweetCountWindow?: number;
  noPostsInPeriod: boolean;
  insufficientForTrend: boolean;
  summaryMessage?: string;
  bucketLabel?: "Daily" | "Weekly";
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
  bucketLabel,
  onRefresh,
  refreshDisabled,
}: EngagementChartProps) {
  const { scaleMax, min: minVal, hasAnyData, lowVariance } = useMemo(() => {
    const vals = points.map((p) => p.engagement_pct).filter((v) => Number.isFinite(v));
    if (vals.length === 0) return { scaleMax: 1, min: 0, hasAnyData: false, lowVariance: false };
    const maxVal = Math.max(0, ...vals);
    let scaleMax: number;
    if (maxVal < 1) scaleMax = 1;
    else if (maxVal < 2) scaleMax = 2;
    else scaleMax = maxVal;
    const min = Math.min(...vals);
    const range = scaleMax - min;
    return { scaleMax, min, hasAnyData: true, lowVariance: range < 0.5 };
  }, [points]);

  const coverage = coverageDays != null && windowDays != null ? `${coverageDays}/${windowDays}d` : undefined;
  const integrationsHref = "/settings/integrations";

  if (noPostsInPeriod) {
    return (
      <ChartCard title="Engagement Rate" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No posts in this window."
          secondary="Post on X to unlock trends."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  if (insufficientForTrend) {
    return (
      <ChartCard title="Engagement Rate" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Not enough data for trend yet."
          secondary={tweetCountWindow != null ? `${tweetCountWindow} posts in window. Need more days.` : "Need more posts to show trend."}
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
      <ChartCard title="Engagement Rate" coverage={coverage} bucketLabel={bucketLabel}>
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

  const MIN_POINTS_FOR_TREND = 3;
  if (points.length < MIN_POINTS_FOR_TREND) {
    return (
      <ChartCard title="Engagement Rate" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Need at least 3 data points to show trend."
          secondary={coverage ? `Active days: ${coverage}` : "More posts in the window will fill the chart."}
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  const barAreaHeight = CHART_H - 28;
  const minBarHeightPct = (4 / barAreaHeight) * 100;

  return (
    <ChartCard title="Engagement Rate" coverage={coverage} bucketLabel={bucketLabel} lowVariance={lowVariance}>
      <div className="relative border-l border-b border-border pl-6 pb-5 pt-1 w-full" style={{ height: CHART_H }}>
        <div className="absolute left-0 top-1 text-[10px] text-muted-foreground tabular-nums">{scaleMax.toFixed(1)}%</div>
        <div className="absolute left-0 bottom-5 text-[10px] text-muted-foreground tabular-nums">0</div>
        <div className="flex items-end gap-px pl-0 w-full" style={{ height: barAreaHeight }}>
          {points.map((p, i) => {
            const val = p.engagement_pct;
            const heightPct = Number.isFinite(val) && val > 0 ? Math.max(minBarHeightPct, (val / scaleMax) * 100) : 0;
            const estSuffix = p.is_estimated ? " (est.)" : "";
            const cappedSuffix = p.is_capped ? " (capped)" : "";
            return (
              <div
                key={`${p.date}-${i}`}
                className="flex-1 min-w-0 rounded-t border-t bg-primary/80 border-primary/50 transition-all"
                style={{ height: `${heightPct}%` }}
                title={`${p.date}: ${Number.isFinite(val) ? `${val.toFixed(1)}%` : "—"}${estSuffix}${cappedSuffix}`}
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
