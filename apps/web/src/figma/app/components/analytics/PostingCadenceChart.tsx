"use client";

import React, { useMemo } from "react";
import { PATH_INTEGRATIONS } from "@/lib/analytics-owner-state-presentation";
import { ChartCard } from "./ChartCard";
import { EmptyState } from "./EmptyState";

const CHART_H = 180;

export interface PostingCadenceChartProps {
  points: Array<{ date: string; posts: number }>;
  /** Days in the window with at least one post (same idea as engagement active days). */
  activePostingDays?: number;
  tweetCountWindow?: number;
  windowDays?: number;
  noPostsInPeriod: boolean;
  insufficientForTrend: boolean;
  summaryMessage?: string;
  bucketLabel?: "Daily" | "Weekly";
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

export function PostingCadenceChart({
  points,
  activePostingDays,
  tweetCountWindow,
  windowDays,
  noPostsInPeriod,
  insufficientForTrend,
  summaryMessage,
  bucketLabel,
  onRefresh,
  refreshDisabled,
}: PostingCadenceChartProps) {
  const { maxPosts, lowVariance } = useMemo(() => {
    const vals = points.map((p) => Number(p.posts) || 0);
    const max = vals.length ? Math.max(1, ...vals) : 1;
    const min = vals.length ? Math.min(...vals) : 0;
    return { maxPosts: max, lowVariance: max - min <= 1 && vals.length > 0 };
  }, [points]);

  const coverage = useMemo(() => {
    const parts: string[] = [];
    if (activePostingDays != null && windowDays != null) {
      parts.push(`${activePostingDays}/${windowDays}d`);
    }
    if (tweetCountWindow != null) {
      parts.push(`${tweetCountWindow} posts`);
    }
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [activePostingDays, windowDays, tweetCountWindow]);

  const hasAnyData = points.length > 0 && points.some((p) => (Number(p.posts) || 0) > 0);

  const integrationsHref = PATH_INTEGRATIONS;

  if (noPostsInPeriod) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No posts in this window."
          secondary="Post on X to unlock trends."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  if (insufficientForTrend) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Not enough data for trend yet."
          secondary={tweetCountWindow != null && windowDays != null ? `${tweetCountWindow} posts in ${windowDays}d. Need more activity.` : "Need more posts to show trend."}
          coverage={coverage}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  if (!hasAnyData || points.length === 0) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="No data in this period."
          secondary="Connect X in Integrations to sync."
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  const MIN_POINTS_FOR_TREND = 3;
  if (points.length < MIN_POINTS_FOR_TREND) {
    return (
      <ChartCard title="Posting Cadence" coverage={coverage} bucketLabel={bucketLabel}>
        <EmptyState
          message="Need at least 3 data points to show trend."
          secondary={coverage ? `${coverage} in window.` : "More posts will fill the chart."}
          onRefresh={onRefresh}
          refreshDisabled={refreshDisabled}
          integrationsHref={integrationsHref}
        />
      </ChartCard>
    );
  }

  const barAreaHeight = CHART_H - 28;
  const minBarHeightPct = (4 / barAreaHeight) * 100;
  const denseWindow = points.length > 14;
  const barTrackMinWidthPx = denseWindow ? points.length * 10 : undefined;

  return (
    <ChartCard title="Posting Cadence" coverage={coverage} bucketLabel={bucketLabel} lowVariance={lowVariance}>
      <div className="relative border-l border-b border-border pl-6 pb-5 pt-1 w-full" style={{ height: CHART_H }}>
        <div className="absolute left-0 top-1 text-[10px] text-muted-foreground tabular-nums">{maxPosts}</div>
        <div className="absolute left-0 bottom-5 text-[10px] text-muted-foreground tabular-nums">0</div>
        <div
          className={`pl-0 w-full ${denseWindow ? "overflow-x-auto overflow-y-hidden" : ""}`}
          style={{ height: barAreaHeight }}
        >
          <div
            className="flex h-full items-stretch gap-px pl-0 w-full"
            style={barTrackMinWidthPx ? { minWidth: barTrackMinWidthPx } : undefined}
          >
            {points.map((p, i) => {
              const posts = Number(p.posts) || 0;
              const heightPct = maxPosts > 0 && posts > 0 ? Math.max(minBarHeightPct, (posts / maxPosts) * 100) : 0;
              return (
                <div
                  key={`${p.date}-${i}`}
                  className="flex min-h-0 min-w-0 flex-1 flex-col justify-end"
                  title={`${p.date}: ${posts} posts`}
                >
                  {heightPct > 0 ? (
                    <div
                      className="w-full rounded-t border-t bg-primary border-primary/60 shadow-sm transition-all"
                      style={{ height: `${heightPct}%`, minHeight: 4 }}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-0.5 tabular-nums">
        <span>{points[0]?.date ?? ""}</span>
        <span>{points[points.length - 1]?.date ?? ""}</span>
      </div>
    </ChartCard>
  );
}
