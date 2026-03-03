"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { KpiCardData, KpiDelta } from "./types";

export interface KpiCardProps {
  data: KpiCardData;
  compact?: boolean;
  /** Light orange tint for analytics page */
  lightOrangeBg?: boolean;
}

const DELTA_FONT = "text-xs font-medium tabular-nums leading-none";
const DELTA_ICON_SIZE = "w-3 h-3 shrink-0";

function DeltaDisplay({
  delta,
  hideWhenNull,
}: {
  delta: KpiDelta;
  hideWhenNull?: boolean;
}) {
  if (delta === null) {
    if (hideWhenNull) return null;
    return <span className={`${DELTA_FONT} text-muted-foreground`}>—</span>;
  }
  const isZero = delta === 0;
  const isPositive = delta > 0;
  const rounded = Number(delta.toFixed(1));
  const color = isZero
    ? "text-muted-foreground"
    : isPositive
      ? "text-primary"
      : "text-orange-500 dark:text-orange-400";
  const Icon = !isZero && isPositive ? TrendingUp : !isZero && !isPositive ? TrendingDown : null;

  return (
    <span className={`inline-flex items-baseline gap-1 ${DELTA_FONT} ${color}`}>
      {Icon && <Icon className={DELTA_ICON_SIZE} aria-hidden />}
      <span className="tabular-nums">{isZero ? "0%" : `${rounded > 0 ? "+" : ""}${rounded}%`}</span>
    </span>
  );
}

export function KpiCard({ data, compact, lightOrangeBg }: KpiCardProps) {
  const { label, value, delta, helper, badge, estimated } = data;
  const cardBg = lightOrangeBg ? "bg-primary/5" : "bg-card";

  if (compact) {
    return (
      <div
        className={`rounded-xl border border-border ${cardBg} px-3 py-2.5 flex items-center justify-between gap-2 min-h-0`}
        data-page="analytics"
        title={helper}
      >
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate shrink-0">
          {label}
          {estimated && (
            <span className="ml-1 normal-case font-normal text-[10px] text-amber-700 dark:text-amber-300">Est.</span>
          )}
        </span>
        <div className="flex items-baseline gap-1.5 flex-nowrap shrink-0 min-w-0">
          <span className="text-lg font-bold text-foreground tabular-nums tracking-tight truncate">{value}</span>
          <DeltaDisplay delta={delta} hideWhenNull={data.id === "followers"} />
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-border ${cardBg} p-4`} data-page="analytics">
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
      <div className="flex items-baseline gap-2.5 min-h-[2rem] flex-nowrap">
        <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight leading-tight">{value}</span>
        <DeltaDisplay delta={delta} hideWhenNull={data.id === "followers"} />
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 leading-snug">{helper}</p>
    </div>
  );
}
