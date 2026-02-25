"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Area,
  AreaChart,
} from "recharts";

export interface SocialGraphDataPoint {
  date: string;
  followers?: number;
  score?: number;
}

export interface SocialGraphCardProps {
  data: SocialGraphDataPoint[];
  seriesEnabled: { followers: boolean; score: boolean; influencers: boolean; projects: boolean; vc: boolean };
  onToggleSeries?: (key: keyof SocialGraphCardProps["seriesEnabled"]) => void;
}

export function SocialGraphCard({ data, seriesEnabled, onToggleSeries }: SocialGraphCardProps) {
  const chartData = useMemo(() => {
    return [...data].reverse();
  }, [data]);

  const hasAny = (seriesEnabled.followers && chartData.some((d) => d.followers != null)) ||
    (seriesEnabled.score && chartData.some((d) => d.score != null));

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <h3 className="text-sm font-semibold text-white/90">Social graph</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {(["followers", "score", "influencers", "projects", "vc"] as const).map((key) => {
          const enabled = seriesEnabled[key];
          const isComingSoon = key !== "followers" && key !== "score";
          return (
            <button
              key={key}
              type="button"
              onClick={() => !isComingSoon && onToggleSeries?.(key)}
              title={isComingSoon ? "Coming soon" : undefined}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                isComingSoon
                  ? "cursor-default bg-white/5 text-white/40"
                  : enabled
                    ? "bg-primary/20 text-primary"
                    : "bg-white/10 text-white/60 hover:bg-white/15"
              }`}
            >
              {key === "vc" ? "VC" : key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          );
        })}
      </div>
      <div className="mt-4 h-64">
        {hasAny && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }}
                tickFormatter={(v) => (typeof v === "string" ? v.slice(0, 6) : v)}
              />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.5)" }} />
              <Tooltip
                contentStyle={{ background: "rgba(0,0,0,0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                labelStyle={{ color: "rgba(255,255,255,0.8)" }}
                formatter={(value: number) => [value, ""]}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {seriesEnabled.followers && (
                <Area
                  type="monotone"
                  dataKey="followers"
                  name="Followers"
                  stroke="rgba(255,83,0,0.8)"
                  fill="rgba(255,83,0,0.15)"
                  strokeWidth={2}
                />
              )}
              {seriesEnabled.score && (
                <Line
                  type="monotone"
                  dataKey="score"
                  name="Score"
                  stroke="rgba(255,255,255,0.7)"
                  strokeWidth={2}
                  dot={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-white/5 text-sm text-white/40">
            No chart data yet
          </div>
        )}
      </div>
    </div>
  );
}
