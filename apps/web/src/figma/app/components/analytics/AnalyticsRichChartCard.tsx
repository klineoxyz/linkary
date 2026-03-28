"use client";

import React, { type ReactNode } from "react";
import type { AnalyticsSignal } from "@/lib/analyticsChartMetrics";

export type AnalyticsRichChartCardProps = {
  title: string;
  /** e.g. selected range + UTC hint */
  windowRangeLabel: string;
  primaryLabel: string;
  primaryValue: string;
  primarySuffix?: string;
  /** When null, prior row is hidden (e.g. follower net has no prior-window KPI). */
  deltaVsPriorPct: number | null;
  showPriorDelta: boolean;
  signal: AnalyticsSignal;
  /** e.g. "74 / 90 days captured" */
  coverageBadge?: string;
  bucketHint?: string;
  insight?: string;
  lowVarianceNote?: boolean;
  children: ReactNode;
};

function SignalPill({ signal }: { signal: AnalyticsSignal }) {
  if (signal === "neutral") return null;
  const map = {
    good: { label: "Good", className: "bg-emerald-500/12 text-emerald-800 ring-1 ring-emerald-500/25" },
    watch: { label: "Watch", className: "bg-amber-500/12 text-amber-900 ring-1 ring-amber-500/30" },
    risk: { label: "Risk", className: "bg-rose-500/12 text-rose-900 ring-1 ring-rose-500/25" },
  } as const;
  const m = map[signal];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums ${m.className}`}
      data-page="analytics"
    >
      {m.label}
    </span>
  );
}

export function AnalyticsRichChartCard({
  title,
  windowRangeLabel,
  primaryLabel,
  primaryValue,
  primarySuffix,
  deltaVsPriorPct,
  showPriorDelta,
  signal,
  coverageBadge,
  bucketHint,
  insight,
  lowVarianceNote,
  children,
}: AnalyticsRichChartCardProps) {
  const deltaColor =
    deltaVsPriorPct == null
      ? "text-muted-foreground"
      : deltaVsPriorPct > 0
        ? "text-emerald-700"
        : deltaVsPriorPct < 0
          ? "text-rose-700"
          : "text-muted-foreground";

  return (
    <div
      className="rounded-2xl border border-border/90 bg-card shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.04] overflow-hidden"
      data-page="analytics"
    >
      <div className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-4 pt-4 pb-3 md:px-5 md:pt-5">
        <div className="flex flex-wrap items-start justify-between gap-2 gap-y-2">
          <div className="min-w-0 space-y-1">
            <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground tabular-nums">
              {windowRangeLabel}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 justify-end shrink-0">
            <SignalPill signal={signal} />
            {coverageBadge ? (
              <span
                className="inline-flex items-center rounded-full border border-border bg-background/80 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground tabular-nums"
                data-page="analytics"
              >
                {coverageBadge}
              </span>
            ) : null}
            {bucketHint ? (
              <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:inline">{bucketHint}</span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-[12rem]">
            <p className="text-[11px] font-medium text-muted-foreground">{primaryLabel}</p>
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 gap-y-0">
              <span className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-foreground">
                {primaryValue}
              </span>
              {primarySuffix ? (
                <span className="text-base sm:text-lg font-semibold text-muted-foreground tabular-nums">
                  {primarySuffix}
                </span>
              ) : null}
            </p>
          </div>
          {showPriorDelta && deltaVsPriorPct != null && Number.isFinite(deltaVsPriorPct) ? (
            <div className={`w-full sm:w-auto sm:max-w-[min(100%,20rem)] text-sm font-semibold tabular-nums leading-snug ${deltaColor}`}>
              <span className="whitespace-nowrap">
                {deltaVsPriorPct > 0 ? "+" : ""}
                {deltaVsPriorPct.toFixed(1)}%
              </span>
              <span className="mt-0.5 block sm:inline sm:mt-0 sm:ml-1.5 text-xs font-normal text-muted-foreground">
                vs prior same length
              </span>
            </div>
          ) : showPriorDelta ? (
            <div className="w-full sm:w-auto text-xs text-muted-foreground">No prior window to compare</div>
          ) : null}
        </div>

        {insight ? <p className="mt-3 text-xs text-muted-foreground leading-relaxed max-w-prose">{insight}</p> : null}
        {lowVarianceNote ? (
          <p className="mt-2 text-[11px] text-muted-foreground/80" data-page="analytics">
            Mostly flat in this window — small moves are normal at this scale.
          </p>
        ) : null}
      </div>

      <div className="px-4 py-4 md:px-5 md:py-5 bg-muted/[0.15]">{children}</div>
    </div>
  );
}
