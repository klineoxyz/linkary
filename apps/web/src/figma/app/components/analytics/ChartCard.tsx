"use client";

import React, { type ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  /** Optional coverage line e.g. "7/30 days" */
  coverage?: string;
  className?: string;
}

export function ChartCard({ title, children, coverage, className = "" }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 md:p-5 ${className}`} data-page="analytics">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {coverage && <span className="text-xs text-muted-foreground tabular-nums">{coverage}</span>}
      </div>
      {children}
    </div>
  );
}
