"use client";

import React, { type ReactNode } from "react";

export interface ChartCardProps {
  title: string;
  children: ReactNode;
  /** Optional coverage line e.g. "Coverage: 7/30 days" */
  coverage?: string;
  className?: string;
}

export function ChartCard({ title, children, coverage, className = "" }: ChartCardProps) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 md:p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {coverage && <p className="text-xs text-muted-foreground mb-3">{coverage}</p>}
      {children}
    </div>
  );
}
