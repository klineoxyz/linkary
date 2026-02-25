"use client";

import React from "react";

export interface ScoreBreakdownRow {
  label: string;
  value: number;
  max?: number;
}

export interface ScoreCardProps {
  reputationIndex: number;
  tierLabel: string;
  breakdown: ScoreBreakdownRow[];
  verifiedGigsLabel: string;
  tips: string[];
}

function scoreToTier(score100: number): string {
  if (score100 >= 75) return "Platinum";
  if (score100 >= 50) return "Gold";
  if (score100 >= 25) return "Silver";
  return "Bronze";
}

export function ScoreCard({
  reputationIndex,
  tierLabel,
  breakdown,
  verifiedGigsLabel,
  tips,
}: ScoreCardProps) {
  const maxBar = 100;
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-white/50">Linkary Score</p>
          <p className="mt-1 text-3xl font-bold text-white">{reputationIndex}</p>
          <p className="text-sm text-white/60">{tierLabel}</p>
        </div>
        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-2xl font-bold text-primary">
          {reputationIndex}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {breakdown.map((row) => {
          const pct = maxBar > 0 ? Math.min(100, (row.value / (row.max ?? maxBar)) * 100) : 0;
          return (
            <div key={row.label}>
              <div className="flex justify-between text-xs">
                <span className="text-white/70">{row.label}</span>
                <span className="text-white/50">{Math.round(row.value)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary/50 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-white/60">{verifiedGigsLabel}</p>
      {tips.length > 0 && (
        <div className="mt-4 rounded-xl bg-white/5 p-3">
          <p className="text-xs font-medium text-white/70">How to increase your score</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-white/60">
            {tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export { scoreToTier };
