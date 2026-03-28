"use client";

import React, { useMemo } from "react";
import { PATH_INTEGRATIONS } from "@/lib/analytics-owner-state-presentation";
import { AnalyticsRichChartCard } from "./AnalyticsRichChartCard";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";
import { buildEngagementRichHeader, type WindowMeta } from "./richHeaderFromPayload";

const CHART_H = 200;

export interface EngagementChartProps {
  points: Array<{ date: string; engagement_pct: number; posts: number; is_estimated?: boolean; is_capped?: boolean }>;
  coverageDays?: number;
  windowDays?: number;
  tweetCountWindow?: number;
  noPostsInPeriod: boolean;
  insufficientForTrend: boolean;
  summaryMessage?: string;
  bucketLabel?: "Daily" | "Weekly";
  onRefresh?: () => void;
  refreshDisabled?: boolean;
  /** Premium shell + header derived from the same KPI math as before */
  useRichShell?: boolean;
  windowMeta?: WindowMeta;
  kpisForRich?: {
    engagement_pct_avg: number;
    posts_total: number;
    prior_engagements_total?: number;
    prior_potential_reach?: number;
  };
}

function Shell(props: {
  rich: Omit<import("./AnalyticsRichChartCard").AnalyticsRichChartCardProps, "children"> | null;
  useRich: boolean;
  legacyCoverage?: string;
  bucketLabel?: "Daily" | "Weekly";
  lowVariance?: boolean;
  children: React.ReactNode;
}) {
  if (props.useRich && props.rich) {
    return (
      <AnalyticsRichChartCard {...props.rich} lowVarianceNote={props.rich.lowVarianceNote}>
        {props.children}
      </AnalyticsRichChartCard>
    );
  }
  return (
    <ChartCard
      title="Engagement Rate"
      coverage={props.legacyCoverage}
      bucketLabel={props.bucketLabel}
      lowVariance={props.lowVariance}
    >
      {props.children}
    </ChartCard>
  );
}

export function EngagementChart({
  points,
  coverageDays,
  windowDays,
  tweetCountWindow,
  noPostsInPeriod,
  insufficientForTrend,
  bucketLabel,
  onRefresh,
  refreshDisabled,
  useRichShell,
  windowMeta,
  kpisForRich,
}: EngagementChartProps) {
  const { scaleMax, hasAnyData, lowVariance, maxEngagement } = useMemo(() => {
    const vals = points
      .map((p) => Number(p.engagement_pct))
      .filter((v) => Number.isFinite(v));
    if (vals.length === 0) return { scaleMax: 1, min: 0, hasAnyData: false, lowVariance: false, maxEngagement: 0 };
    const maxVal = Math.max(0, ...vals);
    let scaleMax: number;
    if (maxVal < 1) scaleMax = 1;
    else if (maxVal < 2) scaleMax = 2;
    else scaleMax = maxVal;
    const min = Math.min(...vals);
    const range = scaleMax - min;
    return {
      scaleMax,
      min,
      hasAnyData: true,
      lowVariance: range < 0.5,
      maxEngagement: maxVal,
    };
  }, [points]);

  const coverage = coverageDays != null && windowDays != null ? `${coverageDays}/${windowDays}d` : undefined;
  const integrationsHref = PATH_INTEGRATIONS;
  const useRich = !!(useRichShell && windowMeta && kpisForRich);

  const baseRich = useMemo(() => {
    if (!useRich || !windowMeta || !kpisForRich) return null;
    return buildEngagementRichHeader({
      window: windowMeta,
      activeDaysWithPosts: coverageDays ?? 0,
      kpis: kpisForRich,
      lowVariance,
    });
  }, [useRich, windowMeta, kpisForRich, coverageDays, lowVariance]);

  if (noPostsInPeriod) {
    const rich =
      baseRich &&
      ({
        ...baseRich,
        primaryValue: "—",
        primarySuffix: undefined,
        deltaVsPriorPct: null,
        insight:
          "No posts in this UTC window — bars and rate need tweets stored for these dates.",
        lowVarianceNote: false,
      } as const);
    return (
      <Shell useRich={useRich} rich={rich ?? null} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No posts in this window."
          secondary="Post on X to unlock trends."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  if (insufficientForTrend) {
    return (
      <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Not enough data for trend yet."
          secondary={
            tweetCountWindow != null
              ? `${tweetCountWindow} posts in window. Need more days.`
              : "Need more posts to show trend."
          }
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No data in this period."
          secondary="Connect X in Integrations to sync."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  const MIN_POINTS_FOR_TREND = 3;
  const hasPostsInWindow = points.some((p) => (Number(p.posts) || 0) > 0);
  if (points.length >= MIN_POINTS_FOR_TREND && hasPostsInWindow && maxEngagement === 0) {
    const rich =
      baseRich &&
      ({
        ...baseRich,
        primaryValue: "—",
        primarySuffix: undefined,
        deltaVsPriorPct: null,
        signal: "watch" as const,
        insight:
          "Stored tweets have no impression counts yet — sync must populate impressions for engagement rate bars.",
        lowVarianceNote: false,
      } as const);
    return (
      <Shell useRich={useRich} rich={rich ?? null} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No impression data in this window."
          secondary="Engagement rate uses impressions per post. After X sync includes impressions, daily bars will appear here."
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  if (points.length < MIN_POINTS_FOR_TREND) {
    return (
      <Shell useRich={useRich} rich={baseRich} legacyCoverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Need at least 3 data points to show trend."
          secondary={coverage ? `Active days: ${coverage}` : "More posts in the window will fill the chart."}
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </Shell>
    );
  }

  const barAreaHeight = CHART_H - 32;
  const minBarHeightPct = (4 / barAreaHeight) * 100;

  const chart = (
    <div className="rounded-lg border border-border/50 bg-background/80 px-2 py-2 shadow-inner/5 min-w-0 max-w-full overflow-hidden">
      <div className="relative border-l border-b border-border/70 pl-7 pb-6 pt-2 w-full min-w-0" style={{ height: CHART_H }}>
        <div className="absolute left-1 top-2 text-[10px] font-medium text-muted-foreground tabular-nums">
          {scaleMax.toFixed(1)}%
        </div>
        <div className="absolute left-1 bottom-6 text-[10px] font-medium text-muted-foreground tabular-nums">0</div>
        <div className="pl-0 w-full min-w-0" style={{ height: barAreaHeight }}>
          <div className="flex h-full min-w-0 w-full items-stretch gap-px">
            {points.map((p, i) => {
              const val = Number(p.engagement_pct);
              const heightPct =
                Number.isFinite(val) && val > 0 ? Math.max(minBarHeightPct, (val / scaleMax) * 100) : 0;
              const estSuffix = p.is_estimated ? " (est.)" : "";
              const cappedSuffix = p.is_capped ? " (capped)" : "";
              return (
                <div
                  key={`${p.date}-${i}`}
                  className="flex min-h-0 min-w-0 flex-1 flex-col justify-end"
                  title={`${p.date}: ${Number.isFinite(val) ? `${val.toFixed(1)}%` : "—"}${estSuffix}${cappedSuffix}`}
                >
                  {heightPct > 0 ? (
                    <div
                      className="w-full rounded-t-sm border-t-2 bg-primary border-primary/50 shadow-sm transition-all"
                      style={{ height: `${heightPct}%`, minHeight: 4 }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-medium text-muted-foreground mt-2.5 px-1 tabular-nums">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </div>
  );

  return (
    <Shell
      useRich={useRich}
      rich={baseRich}
      legacyCoverage={coverage}
      bucketLabel={bucketLabel}
      lowVariance={lowVariance}
    >
      {chart}
    </Shell>
  );
}
