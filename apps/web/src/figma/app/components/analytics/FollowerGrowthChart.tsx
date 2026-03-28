"use client";

import React, { useMemo } from "react";
import { PATH_INTEGRATIONS } from "@/lib/analytics-owner-state-presentation";
import { AnalyticsRichChartCard } from "./AnalyticsRichChartCard";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { buildFollowerRichHeader, type WindowMeta } from "./richHeaderFromPayload";

export interface FollowerGrowthChartProps {
  points: Array<{ date: string; follower_delta: number | null }>;
  coverageDays?: number;
  windowDays?: number;
  earliestDate?: string | null;
  insufficientData: boolean;
  bucketLabel?: "Daily" | "Weekly";
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  useRichShell?: boolean;
  windowMeta?: WindowMeta;
}

const VIEW_W = 420;
const VIEW_H = 188;

export function FollowerGrowthChart({
  points,
  coverageDays,
  windowDays,
  earliestDate,
  insufficientData,
  bucketLabel,
  onRefresh,
  refreshDisabled,
  useRichShell,
  windowMeta,
}: FollowerGrowthChartProps) {
  const { hasAnyData, series } = useMemo(() => {
    let cum = 0;
    const seriesPts = points.map((p) => {
      const d = p.follower_delta == null ? null : Number(p.follower_delta);
      if (d != null && Number.isFinite(d)) cum += d;
      return { date: p.date, cum, hasSnap: d != null && Number.isFinite(d) };
    });
    const hasSnap = points.some(
      (p) => p.follower_delta != null && Number.isFinite(Number(p.follower_delta))
    );
    return { hasAnyData: hasSnap, series: seriesPts };
  }, [points]);

  const coverage =
    coverageDays != null && windowDays != null ? `${coverageDays}/${windowDays}d` : undefined;
  const integrationsHref = PATH_INTEGRATIONS;
  const useRich = !!(useRichShell && windowMeta);

  const covDays = coverageDays ?? 0;

  const richHeader = useMemo(() => {
    if (!useRich || !windowMeta) return null;
    if (insufficientData) {
      return buildFollowerRichHeader({
        window: windowMeta,
        coverageDays: covDays,
        points,
        earliestDate,
        mode: "insufficient",
        insufficientHasPartial: covDays > 0 || !!earliestDate,
      });
    }
    if (!hasAnyData || points.length === 0) {
      return buildFollowerRichHeader({
        window: windowMeta,
        coverageDays: covDays,
        points,
        earliestDate,
        mode: "empty",
      });
    }
    return buildFollowerRichHeader({
      window: windowMeta,
      coverageDays: covDays,
      points,
      earliestDate,
      mode: "ok",
    });
  }, [useRich, windowMeta, insufficientData, hasAnyData, points, covDays, earliestDate]);

  const wrap = (inner: React.ReactNode) => {
    if (useRich && richHeader) {
      return (
        <AnalyticsRichChartCard {...richHeader} lowVarianceNote={richHeader.lowVarianceNote}>
          {inner}
        </AnalyticsRichChartCard>
      );
    }
    return (
      <ChartCard title="Follower Growth" coverage={coverage} bucketLabel={bucketLabel}>
        {inner}
      </ChartCard>
    );
  };

  if (insufficientData) {
    const hasAnyFollowerDays = covDays > 0 || !!earliestDate;
    const message = hasAnyFollowerDays
      ? earliestDate
        ? "Follower history starts on " + earliestDate + "."
        : "Follower history is starting to populate."
      : "No follower history yet.";
    return wrap(
      <EmptyState
        message={message}
        secondary={
          hasAnyFollowerDays
            ? "More daily snapshots will tighten this trend line."
            : "Connect X and check back tomorrow."
        }
        coverage={earliestDate ? `First: ${earliestDate}` : coverage}
        onRefresh={onRefresh}
        refreshDisabled={refreshDisabled}
        integrationsHref={integrationsHref}
      />
    );
  }

  if (!hasAnyData || points.length === 0) {
    return wrap(
      <EmptyState
        message="No follower data in this period."
        secondary="Connect X in Integrations to sync."
        onRefresh={onRefresh}
        refreshDisabled={refreshDisabled}
        integrationsHref={integrationsHref}
      />
    );
  }

  const cums = series.map((s) => s.cum);
  let minY = cums.length ? Math.min(0, ...cums) : 0;
  let maxY = cums.length ? Math.max(0, ...cums) : 1;
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }

  const n = series.length;
  const span = maxY - minY || 1;
  const padY = Math.max(Math.abs(span) * 0.12, 1);
  const y0 = minY - padY;
  const y1 = maxY + padY;
  const leftG = 36;
  const rightG = 10;
  const topG = 14;
  const bottomG = 26;
  const iw = VIEW_W - leftG - rightG;
  const ih = VIEW_H - topG - bottomG;
  const toX = (i: number) => leftG + (n <= 1 ? iw / 2 : (i / Math.max(n - 1, 1)) * iw);
  const toY = (cum: number) => topG + ih - ((cum - y0) / (y1 - y0)) * ih;

  const linePath = series
    .map((s, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(2)} ${toY(s.cum).toFixed(2)}`)
    .join(" ");
  const lastX = toX(n - 1);
  const firstX = toX(0);
  const baseY = topG + ih;
  const areaPath = `${linePath} L ${lastX.toFixed(2)} ${baseY} L ${firstX.toFixed(2)} ${baseY} Z`;

  const uid = React.useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradId = `followerAreaGrad-${uid}`;

  const chart = (
    <div className="rounded-lg border border-border/50 bg-background/80 px-2 py-2 shadow-inner min-h-[200px] min-w-0 max-w-full overflow-hidden flex flex-col justify-center">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full max-w-full h-auto min-h-[160px] max-h-[220px] text-muted-foreground"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Follower growth cumulative change"
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const gy = topG + ih * t;
          return (
            <line
              key={t}
              x1={leftG}
              y1={gy}
              x2={VIEW_W - rightG}
              y2={gy}
              stroke="currentColor"
              strokeOpacity={0.06}
              strokeWidth={1}
            />
          );
        })}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {series.map((s, i) =>
          s.hasSnap ? (
            <circle
              key={`${s.date}-${i}`}
              cx={toX(i)}
              cy={toY(s.cum)}
              r={2.25}
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth={1.5}
            />
          ) : null
        )}
        <text x={leftG - 4} y={topG + 8} textAnchor="end" fill="currentColor" className="text-[9px] font-medium tabular-nums">
          {Math.round(y1)}
        </text>
        <text x={leftG - 4} y={baseY - 2} textAnchor="end" fill="currentColor" className="text-[9px] font-medium tabular-nums">
          {Math.round(y0)}
        </text>
        <text x={firstX} y={VIEW_H - 6} textAnchor="start" fill="currentColor" className="text-[9px] font-medium tabular-nums">
          {points[0]?.date ?? ""}
        </text>
        <text x={lastX} y={VIEW_H - 6} textAnchor="end" fill="currentColor" className="text-[9px] font-medium tabular-nums">
          {points[points.length - 1]?.date ?? ""}
        </text>
      </svg>
      <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
        Cumulative line from daily follower deltas; <span className="font-medium text-foreground/85">flat segments</span> mean no
        snapshot that day. Orange dots mark days with data.
      </p>
    </div>
  );

  return wrap(chart);
}
