"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { KpiCardData, KpiDelta } from "./types";

export interface KpiCardProps {
  data: KpiCardData;
}

function DeltaDisplay({ delta }: { delta: KpiDelta }) {
  if (delta === null) {
    return <span className="text-sm text-muted-foreground tabular-nums">—</span>;
  }
  const isZero = delta === 0;
  const isPositive = delta > 0;
  const rounded = Number(delta.toFixed(1));
  const color = isZero ? "text-muted-foreground" : isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400";
  const Icon = !isZero && isPositive ? TrendingUp : !isZero && !isPositive ? TrendingDown : null;

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium tabular-nums ${color}`}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
      {isZero ? "0%" : `${rounded > 0 ? "+" : ""}${rounded}%`}
    </span>
  );
}

export function KpiCard({ data }: KpiCardProps) {
  const { label, value, delta, helper, badge, estimated } = data;

  return (
    <div className="rounded-xl border border-border bg-card p-4" data-page="analytics">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
          {label}
          {estimated && (
            <span className="ml-1 normal-case font-normal text-[10px] text-amber-700 dark:text-amber-300">Est.</span>
          )}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground/80 uppercase tracking-wider shrink-0">
          {badge}
        </span>
      </div>
      <div className="flex items-baseline gap-2 min-h-[1.75rem]">
        <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{value}</span>
        <DeltaDisplay delta={delta} />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{helper}</p>
    </div>
  );
}
