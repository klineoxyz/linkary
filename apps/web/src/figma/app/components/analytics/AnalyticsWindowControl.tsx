"use client";

import React from "react";

export type AnalyticsWindowKey = "7d" | "30d" | "90d";

export type AnalyticsWindowControlProps = {
  value: AnalyticsWindowKey;
  onChange: (w: AnalyticsWindowKey) => void;
  /** Optional short context, e.g. date span */
  subtitle?: string;
  className?: string;
};

const OPTIONS: { id: AnalyticsWindowKey; label: string; hint: string }[] = [
  { id: "7d", label: "7D", hint: "Last week" },
  { id: "30d", label: "30D", hint: "Last month" },
  { id: "90d", label: "90D", hint: "Last quarter" },
];

export function AnalyticsWindowControl({ value, onChange, subtitle, className = "" }: AnalyticsWindowControlProps) {
  return (
    <div className={`space-y-1.5 ${className}`} data-page="analytics">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Reporting window</p>
          {subtitle ? (
            <p className="text-xs text-muted-foreground/90 tabular-nums mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div
        className="inline-flex rounded-xl border border-border/80 bg-muted/30 p-1 shadow-inner"
        role="group"
        aria-label="Analytics time window"
      >
        {OPTIONS.map((opt) => {
          const active = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              aria-pressed={active}
              title={opt.hint}
              className={`relative min-w-[4.25rem] sm:min-w-[5rem] rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 text-center transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                active
                  ? "bg-card text-foreground shadow-md ring-2 ring-primary/35 ring-offset-2 ring-offset-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}
            >
              <span className="block text-sm font-bold tabular-nums tracking-tight">{opt.label}</span>
              <span className={`block text-[10px] font-medium mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`}>
                {opt.hint}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
