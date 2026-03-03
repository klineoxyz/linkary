"use client";

import React, { type ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  coverage?: string;
  /** "Daily" or "Weekly" to show bucket type next to coverage */
  bucketLabel?: "Daily" | "Weekly";
  /** When true, show "Low variance in this window" below chart */
  lowVariance?: boolean;
  className?: string;
}

export function ChartCard({ title, children, coverage, bucketLabel, lowVariance, className = "" }: ChartCardProps) {
  const coverageText = [coverage, bucketLabel].filter(Boolean).join(" · ");
  return (
    <div className={`rounded-xl border border-border bg-card p-4 md:p-5 ${className}`} data-page="analytics">
      <div className="flex items-baseline justify-between gap-3 mb-2.5 min-h-[1.25rem]">
        <h3 className="text-sm font-semibold text-foreground leading-tight truncate">{title}</h3>
        {coverageText && <span className="text-xs text-muted-foreground tabular-nums shrink-0">{coverageText}</span>}
      </div>
      <div className="min-h-[152px]">
        {children}
      </div>
      {lowVariance && (
        <p className="text-[11px] text-muted-foreground/70 mt-2" data-page="analytics">Mostly flat in this window.</p>
      )}
    </div>
  );
}
