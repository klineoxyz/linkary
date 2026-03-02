"use client";

import React, { type ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  coverage?: string;
  /** When true, show "Low variance in this window" below chart */
  lowVariance?: boolean;
  className?: string;
}

export function ChartCard({ title, children, coverage, lowVariance, className = "" }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 md:p-5 ${className}`} data-page="analytics">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {coverage && <span className="text-xs text-muted-foreground tabular-nums">{coverage}</span>}
      </div>
      <div className="min-h-[152px]">
        {children}
      </div>
      {lowVariance && (
        <p className="text-[11px] text-muted-foreground/70 mt-2" data-page="analytics">Low variance in window.</p>
      )}
    </div>
  );
}
