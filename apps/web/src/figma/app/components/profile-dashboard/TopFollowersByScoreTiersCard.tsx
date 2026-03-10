"use client";

import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BarChart3 } from "lucide-react";
import { EmptyStateCard } from "./EmptyStateCard";

export interface TopFollowerItemForTiers {
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  followers?: number | null;
  tier?: string | null;
  score?: number | null;
}

export interface TopFollowersByScoreTiersCardProps {
  /** All top follower items (from influencers + projects + funds) for tier distribution. */
  items: TopFollowerItemForTiers[];
  emptyMessage?: string;
  /** Use "light" on light page backgrounds. */
  variant?: "light" | "dark";
}

const SCORE_TIER_LABELS = ["<250", "250-500", "500-1000", "1000-1500", "1500-2000", "2000-2500", ">2500"] as const;
const SCORE_TIER_RANGES: [number, number][] = [[0, 250], [250, 500], [500, 1000], [1000, 1500], [1500, 2000], [2000, 2500], [2500, 1e9]];

function bucketByScoreTier(items: TopFollowerItemForTiers[]): { tier: string; count: number }[] {
  const counts = new Map<string, number>();
  SCORE_TIER_LABELS.forEach((t) => counts.set(t, 0));
  for (const item of items) {
    const tierLabel = item.tier?.trim();
    if (tierLabel && SCORE_TIER_LABELS.includes(tierLabel as typeof SCORE_TIER_LABELS[number])) {
      counts.set(tierLabel, (counts.get(tierLabel) ?? 0) + 1);
    } else {
      const score = item.score ?? item.followers ?? 0;
      const num = typeof score === "number" ? score : 0;
      const idx = SCORE_TIER_RANGES.findIndex(([lo, hi]) => num >= lo && num < hi);
      const tier = idx >= 0 ? SCORE_TIER_LABELS[idx] : ">2500";
      counts.set(tier, (counts.get(tier) ?? 0) + 1);
    }
  }
  return SCORE_TIER_LABELS.map((tier) => ({ tier, count: counts.get(tier) ?? 0 }));
}

export function TopFollowersByScoreTiersCard({
  items,
  emptyMessage = "No top followers data yet. Connect X and refresh insights.",
  variant = "dark",
}: TopFollowersByScoreTiersCardProps) {
  const chartData = useMemo(() => bucketByScoreTier(items), [items]);
  const total = chartData.reduce((s, d) => s + d.count, 0);
  const isLight = variant === "light";
  const wrapper = isLight
    ? "rounded-2xl border border-border bg-card p-6"
    : "rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6";
  const titleClass = isLight ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-white/90";

  if (total === 0) {
    return (
      <div className={wrapper}>
        <h3 className={titleClass}>Top followers by score tiers</h3>
        <EmptyStateCard
          variant={variant}
          title="No data yet"
          message={emptyMessage}
          icon={<BarChart3 className="h-10 w-10" />}
          className="mt-3 border-0 bg-transparent p-0"
        />
      </div>
    );
  }

  const barFill = isLight ? "hsl(var(--primary))" : "rgba(255,255,255,0.5)";

  return (
    <div className={wrapper}>
      <h3 className={titleClass}>Top followers by score tiers</h3>
      <p className="mt-1 text-xs text-muted-foreground">{total} top followers</p>
      <div className="mt-4 h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "hsl(var(--border))" : "rgba(255,255,255,0.08)"} />
            <XAxis dataKey="tier" tick={{ fontSize: 10 }} stroke={isLight ? "hsl(var(--muted-foreground))" : "rgba(255,255,255,0.5)"} />
            <YAxis tick={{ fontSize: 10 }} stroke={isLight ? "hsl(var(--muted-foreground))" : "rgba(255,255,255,0.5)"} />
            <Tooltip
              contentStyle={isLight ? { background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" } : { background: "rgba(0,0,0,0.8)", border: "none", borderRadius: "8px" }}
              labelStyle={{ color: isLight ? "hsl(var(--foreground))" : "#fff" }}
              formatter={(value: number) => [value, "Count"]}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill={barFill}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={barFill} opacity={0.7 + (0.3 * (i + 1)) / chartData.length} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
