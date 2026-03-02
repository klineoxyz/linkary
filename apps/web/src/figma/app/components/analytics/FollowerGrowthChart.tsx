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
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function FollowerGrowthChart({
  points,
  coverageDays,
  windowDays,
  earliestDate,
  insufficientData,
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
  const coverage = coverageDays != null && windowDays != null ? `${coverageDays}/${windowDays} days` : undefined;

  if (insufficientData) {
    return (
      <ChartCard title="Follower Growth" coverage={coverage}>
        <EmptyState
          message="Building history. A few daily snapshots needed for trends."
          coverage={earliestDate ? `First: ${earliestDate}` : coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
        />
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Follower Growth" coverage={coverage}>
        <EmptyState message="No data in this period." onRefresh={onRefresh} refreshDisabled={refreshDisabled} />
      </ChartCard>
    );
  }

  const zeroPct = min < 0 && max > 0 ? ((0 - min) / range) * 100 : min >= 0 ? 0 : 100;
  const CHART_H = 180;

  return (
    <ChartCard title="Follower Growth" coverage={coverage}>
      <div className="relative border-l border-b border-border pl-6 pb-5 pt-1" style={{ minHeight: CHART_H }}>
        <div className="absolute left-0 top-1 text-[10px] text-muted-foreground tabular-nums">{max}</div>
        <div className="absolute left-0 bottom-5 text-[10px] text-muted-foreground tabular-nums">0</div>
        {min < 0 && max > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/70 z-0"
            style={{ bottom: `calc(${zeroPct}% + 1.25rem)` }}
          />
        )}
        <div className="flex items-end gap-0.5 pl-0" style={{ minHeight: CHART_H - 28 }}>
          {points.map((p, i) => {
            const val = p.follower_delta;
            const hasData = val !== null && val !== undefined && Number.isFinite(val);
            const heightPct = hasData ? Math.max(1, (((val as number) - min) / range) * 100) : 0;
            const isNegative = hasData && (val as number) < 0;

            if (!hasData) {
              return <div key={p.date} className="flex-1 min-w-[6px]" title={`${p.date}: No snapshot`} />;
            }
            return (
              <div
                key={`${p.date}-${i}`}
                className={`flex-1 min-w-[6px] max-w-[12px] rounded-t border-t transition-all ${
                  isNegative ? "bg-amber-500/70 border-amber-500/50" : "bg-primary/80 border-primary/50"
                }`}
                style={{ height: `${heightPct}%` }}
                title={`${p.date}: ${(val as number) >= 0 ? "+" : ""}${(val as number).toLocaleString()}`}
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
