"use client";

import React, { useMemo } from "react";
import { PATH_INTEGRATIONS } from "@/lib/analytics-owner-state-presentation";
import { AnalyticsRichChartCard } from "./AnalyticsRichChartCard";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { buildFollowerRichHeader, type WindowMeta } from "./richHeaderFromPayload";
import type { FollowerNetEndpointSource } from "@/lib/xAnalyticsPayloadBuild";

export interface FollowerGrowthChartProps {
  points: Array<{ date: string; follower_delta: number | null }>;
  coverageDays?: number;
  windowDays?: number;
  earliestDate?: string | null;
  baselineDay?: string | null;
  hasPreWindowBaseline?: boolean;
  netEndpointSource?: FollowerNetEndpointSource | null;
  netEndpointSnapshotDay?: string | null;
  insufficientData: boolean;
  bucketLabel?: "Daily" | "Weekly";
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  useRichShell?: boolean;
  windowMeta?: WindowMeta;
}

/** Wide viewBox so preserveAspectRatio meet fills card width (narrow viewBox caused letterboxed “island”). */
const VIEW_W = 1000;
const VIEW_H = 248;

export function FollowerGrowthChart({
  points,
  coverageDays,
  windowDays,
  earliestDate,
  baselineDay,
  hasPreWindowBaseline = false,
  netEndpointSource,
  netEndpointSnapshotDay,
  insufficientData,
  bucketLabel,
  onRefresh,
  refreshDisabled,
  useRichShell,
  windowMeta,
}: FollowerGrowthChartProps) {
  const { hasAnyData, series, snapDayCount } = useMemo(() => {
    let cum = 0;
    const seriesPts = points.map((p) => {
      const d = p.follower_delta == null ? null : Number(p.follower_delta);
      if (d != null && Number.isFinite(d)) cum += d;
      return { date: p.date, cum, hasSnap: d != null && Number.isFinite(d) };
    });
    const hasSnap = points.some(
      (p) => p.follower_delta != null && Number.isFinite(Number(p.follower_delta))
    );
    const snapDayCount = seriesPts.filter((s) => s.hasSnap).length;
    return { hasAnyData: hasSnap, series: seriesPts, snapDayCount };
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
      ? covDays === 1 && (windowDays ?? 0) > 1 && !hasPreWindowBaseline
        ? "Not enough stored follower history to define net change for this full window."
        : earliestDate
          ? "Follower snapshot coverage starts " + earliestDate + " — still thin for this range."
          : "Follower snapshot coverage in Linkary is still limited for this window."
      : "No stored follower totals for this window yet.";
    return wrap(
      <EmptyState
        message={message}
        secondary={
          hasAnyFollowerDays
            ? "As daily totals accumulate in our tables, this view will firm up on its own."
            : "Once this account has stored daily follower snapshots in Linkary, growth will appear here."
        }
        coverage={earliestDate ? `First: ${earliestDate}` : coverage}
        onRefresh={onRefresh}
        refreshDisabled={refreshDisabled}
        integrationsHref={integrationsHref}
      />
    );
  }

  if (!hasAnyData || points.length === 0) {
    const hasCoverage = covDays > 0 || !!earliestDate;
    return wrap(
      <EmptyState
        message={
          hasCoverage
            ? "Stored follower snapshots are too sparse to draw a trend in this window."
            : "No chartable follower deltas in this period."
        }
        secondary={
          hasCoverage
            ? `Coverage ${coverage ?? "partial"} · Tweet-based metrics may still load from stored posts; follower line needs more daily totals in our database for this range.`
            : "No daily follower totals in our tables for this UTC window yet."
        }
        coverage={earliestDate ? `First: ${earliestDate}` : coverage}
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
    const pad = minY === 0 ? 2 : Math.max(1, Math.abs(minY) * 0.08);
    minY -= pad;
    maxY += pad;
  }

  const n = series.length;
  const span = maxY - minY || 1;
  const padY = Math.max(Math.abs(span) * 0.14, 1.5);
  const y0 = minY - padY;
  const y1 = maxY + padY;
  const leftG = 48;
  const rightG = 16;
  const topG = 16;
  const bottomG = 34;
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
  const yMid = (y0 + y1) / 2;
  const strokeW = snapDayCount <= 4 ? 3 : 2.5;
  const dotR = snapDayCount <= 4 ? 4 : 3;

  const chart = (
    <div className="rounded-lg border border-border/50 bg-background/80 px-1 sm:px-2 py-2 shadow-inner w-full min-w-0 overflow-hidden flex flex-col justify-center">
      <div className="w-full min-w-0 aspect-[1000/248] min-h-[176px] max-h-[min(320px,52vw)]">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="w-full h-full block text-muted-foreground"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Follower growth: cumulative net from daily snapshot deltas in this window"
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
            strokeWidth={strokeW}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {series.map((s, i) =>
            s.hasSnap ? (
              <circle
                key={`${s.date}-${i}`}
                cx={toX(i)}
                cy={toY(s.cum)}
                r={dotR}
                fill="var(--primary)"
                stroke="var(--card)"
                strokeWidth={1.5}
              />
            ) : null
          )}
          <text
            x={leftG - 6}
            y={topG + 6}
            textAnchor="end"
            fill="currentColor"
            className="text-[10px] font-semibold tabular-nums"
          >
            {Math.round(y1)}
          </text>
          <text
            x={leftG - 6}
            y={topG + ih / 2}
            dominantBaseline="middle"
            textAnchor="end"
            fill="currentColor"
            className="text-[9px] font-medium tabular-nums opacity-80"
          >
            {Math.round(yMid)}
          </text>
          <text
            x={leftG - 6}
            y={baseY - 2}
            textAnchor="end"
            fill="currentColor"
            className="text-[10px] font-semibold tabular-nums"
          >
            {Math.round(y0)}
          </text>
          <text
            x={firstX}
            y={VIEW_H - 8}
            textAnchor="start"
            fill="currentColor"
            className="text-[10px] font-semibold tabular-nums"
          >
            {points[0]?.date ?? ""}
          </text>
          <text
            x={lastX}
            y={VIEW_H - 8}
            textAnchor="end"
            fill="currentColor"
            className="text-[10px] font-semibold tabular-nums"
          >
            {points[points.length - 1]?.date ?? ""}
          </text>
        </svg>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground leading-snug px-0.5">
        <span className="font-medium text-foreground/90">How to read this:</span> the line is{" "}
        <span className="text-foreground/85">cumulative net followers</span> from daily changes between stored snapshot totals (UTC).
        {hasPreWindowBaseline && baselineDay
          ? ` The start level comes from the stored snapshot on ${baselineDay}.`
          : " When there is no earlier daily snapshot in our data, the first day with totals anchors at 0."}{" "}
        Flat segments are days without a new total; dots are days with a snapshot. The header net matches the line when the same
        start/end levels are used.
      </p>
    </div>
  );

  return wrap(chart);
}
