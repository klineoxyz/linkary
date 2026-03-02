"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { KpiCardData, KpiDelta } from "./types";

export interface KpiCardProps {
  data: KpiCardData;
}

/**
 * Delta display rules:
 * - null → "Delta: --", helper "Not enough data", no arrow
 * - 0 → "0%" no arrow
 * - non-zero → round 1 decimal, arrow (up/down)
 * Never show 0.00% unless it is real and computed.
 */
function DeltaDisplay({ delta }: { delta: KpiDelta }) {
  if (delta === null) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const isZero = delta === 0;
  const isPositive = delta > 0;
  const rounded = Number(delta.toFixed(1));
  const color = isZero ? "text-muted-foreground" : isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  const Icon = !isZero && isPositive ? TrendingUp : !isZero && !isPositive ? TrendingDown : null;

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${color}`}>
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {isZero ? "0%" : `${rounded > 0 ? "+" : ""}${rounded}%`}
    </span>
  );
}

export function KpiCard({ data }: KpiCardProps) {
  const { label, value, delta, helper, badge, estimated } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-4 md:p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
          {estimated && (
            <span className="ml-1.5 inline-block px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-normal normal-case">
              Estimated
            </span>
          )}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider shrink-0">
          {badge}
        </span>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">{value}</span>
        <DeltaDisplay delta={delta} />
      </div>
      <p className="text-xs text-muted-foreground mt-2 leading-snug">{helper}</p>
    </div>
  );
}
