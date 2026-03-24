"use client";

import React, { useMemo } from "react";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";

export interface FollowerGrowthChartProps {
  points: Array<{ date: string; follower_delta: number | null }>;
  coverageDays?: number;
  windowDays?: number;
  earliestDate?: string | null;
  insufficientData: boolean;
  bucketLabel?: "Daily" | "Weekly";
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function FollowerGrowthChart({
  points,
  coverageDays,
  windowDays,
  earliestDate,
  insufficientData,
  bucketLabel,
  onRefresh,
  refreshDisabled,
}: FollowerGrowthChartProps) {
  const { min, max, hasAnyData } = useMemo(() => {
    const numeric = points.map((p) => p.follower_delta).filter((v): v is number => v != null && Number.isFinite(v));
    if (numeric.length === 0) return { min: 0, max: 1, hasAnyData: false };
    const minVal = Math.min(0, ...numeric);
    const maxVal = Math.max(0, ...numeric);
    return { min: minVal, max: maxVal === minVal ? minVal + 1 : maxVal, hasAnyData: true };
  }, [points]);

  const range = max - min || 1;
  const coverage = coverageDays != null && windowDays != null ? `${coverageDays}/${windowDays}d` : undefined;
  const lowVariance = hasAnyData && range > 0 && range <= 2;

  const integrationsHref = "/settings/integrations";

  if (insufficientData) {
    const hasAnyFollowerDays = (coverageDays ?? 0) > 0 || !!earliestDate;
    const message = hasAnyFollowerDays
      ? earliestDate
        ? "Follower history starts on " + earliestDate + "."
        : "Follower history is starting to populate."
      : "No follower history yet.";
    return (
      <ChartCard title="Follower Growth" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message={message}
          secondary={hasAnyFollowerDays ? "Need a few more days of follower tracking to show a trend." : "Connect X and check back tomorrow."}
          coverage={earliestDate ? `First: ${earliestDate}` : coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Follower Growth" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No follower data in this period."
          secondary="Connect X in Integrations to sync."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  const zeroPct = min < 0 && max > 0 ? ((0 - min) / range) * 100 : min >= 0 ? 0 : 100;
  const CHART_H = 180;
  const barAreaHeight = CHART_H - 28;
  const minBarHeightPct = (4 / barAreaHeight) * 100;

  return (
    <ChartCard title="Follower Growth" coverage={coverage} bucketLabel={bucketLabel} lowVariance={lowVariance}>
      <div className="relative border-l border-b border-border pl-6 pb-5 pt-1 w-full" style={{ height: CHART_H }}>
        <div className="absolute left-0 top-1 text-[10px] text-muted-foreground tabular-nums">{max}</div>
        <div className="absolute left-0 bottom-5 text-[10px] text-muted-foreground tabular-nums">0</div>
        {min < 0 && max > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/70 z-0"
            style={{ bottom: `calc(${zeroPct}% + 1.25rem)` }}
          />
        )}
        {/* items-stretch + per-column flex-col so bar height % resolves against a definite column height */}
        <div className="flex items-stretch gap-px pl-0 w-full" style={{ height: barAreaHeight }}>
          {points.map((p, i) => {
            const val = p.follower_delta;
            const hasData = val !== null && val !== undefined && Number.isFinite(val);
            const heightPct = hasData ? Math.max(minBarHeightPct, (((val as number) - min) / range) * 100) : 0;
            const isNegative = hasData && (val as number) < 0;

            return (
              <div
                key={`${p.date}-${i}`}
                className="flex min-h-0 min-w-0 flex-1 flex-col justify-end"
                title={
                  hasData
                    ? `${p.date}: ${(val as number) >= 0 ? "+" : ""}${(val as number).toLocaleString()}`
                    : `${p.date}: No snapshot`
                }
              >
                {hasData ? (
                  <div
                    className={`w-full rounded-t border-t transition-all ${
                      isNegative ? "bg-amber-500/70 border-amber-500/50" : "bg-primary/80 border-primary/50"
                    }`}
                    style={{ height: `${heightPct}%`, minHeight: 4 }}
                  />
                ) : null}
              </div>
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
