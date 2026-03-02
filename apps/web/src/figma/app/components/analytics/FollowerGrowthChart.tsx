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
          message="Follower history is still building. We need a few daily snapshots to show trends."
          coverage={earliestDate ? `First snapshot: ${earliestDate}` : undefined}
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

  return (
    <ChartCard title="Follower Growth" coverage={coverage}>
      <div className="relative border-l border-b border-border" style={{ minHeight: 160 }}>
        {/* Y-axis: 0 and max (and min if negative) */}
        <div className="absolute left-0 top-0 text-[10px] text-muted-foreground -translate-y-0.5">{max}</div>
        {min < 0 && <div className="absolute left-0 text-[10px] text-muted-foreground" style={{ bottom: `${zeroPct}%` }}>0</div>}
        {min >= 0 && <div className="absolute left-0 bottom-0 text-[10px] text-muted-foreground translate-y-0.5">0</div>}
        {/* Zero baseline line */}
        {min < 0 && max > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-dashed border-border/60 z-0"
            style={{ bottom: `${zeroPct}%` }}
          />
        )}
        <div className="flex items-end gap-px pl-5 pb-4 pt-4" style={{ minHeight: 160 }}>
          {points.map((p, i) => {
            const val = p.follower_delta;
            const hasData = val !== null && val !== undefined && Number.isFinite(val);
            const heightPct = hasData ? Math.max(0.5, (((val as number) - min) / range) * 100) : 0;
            const isNegative = hasData && (val as number) < 0;

            if (!hasData) {
              return <div key={p.date} className="flex-1 min-w-[4px]" title={`${p.date}: No snapshot`} />;
            }
            return (
              <div
                key={`${p.date}-${i}`}
                className={`flex-1 min-w-[4px] rounded-t-sm border-t transition-all ${
                  isNegative ? "bg-amber-500/60 border-amber-500/50" : "bg-primary/70 border-primary/50"
                }`}
                style={{ height: `${heightPct}%` }}
                title={`${p.date}: ${(val as number) >= 0 ? "+" : ""}${(val as number).toLocaleString()}`}
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
