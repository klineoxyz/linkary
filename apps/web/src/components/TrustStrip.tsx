"use client";

import React from "react";

export function scoreToTier(score100: number): string {
  if (score100 >= 75) return "Platinum";
  if (score100 >= 50) return "Gold";
  if (score100 >= 25) return "Silver";
  return "Bronze";
}

const REP_TOOLTIP = "REP is based on social signals, verified work, and network trust.";
const TIER_TOOLTIP = "Reputation tier from your Linkary score: Bronze (<25), Silver (25–49), Gold (50–74), Platinum (75+).";

export interface TrustStripProps {
  /** Linkary score / reputation (0–100). */
  score: number | null;
  /** Tier label (e.g. Platinum). If null, derived from score. */
  tierLabel: string | null;
  /** Verified gigs count (own profile only on insights). */
  verifiedGigsCount?: number | null;
  /** Reviews average (1–5). */
  reviewsAvg?: number | null;
  /** Reviews count (verified). */
  reviewsCount?: number | null;
  /** Optional variant for styling. */
  variant?: "public" | "insights";
  /** If true, do not show score/tier pills (e.g. when shown in profile header). */
  hideScoreAndTier?: boolean;
}

const pillClass =
  "inline-flex items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm";

export function TrustStrip({
  score,
  tierLabel,
  verifiedGigsCount = null,
  reviewsAvg = null,
  reviewsCount = null,
  variant = "public",
  hideScoreAndTier = false,
}: TrustStripProps) {
  const tier = tierLabel ?? (score != null ? scoreToTier(score) : null);
  const showVerified = (reviewsCount != null && reviewsCount > 0) || (verifiedGigsCount != null && verifiedGigsCount > 0);
  const pills: { key: string; label: string; title?: string }[] = [];

  if (!hideScoreAndTier && score != null) {
    pills.push({ key: "score", label: `${score} rep`, title: REP_TOOLTIP });
  }
  if (!hideScoreAndTier && tier) {
    pills.push({ key: "tier", label: tier, title: TIER_TOOLTIP });
  }
  if (showVerified) {
    pills.push({ key: "verified", label: "Verified" });
  }
  if (reviewsCount != null && reviewsCount > 0) {
    const avg = reviewsAvg != null ? reviewsAvg.toFixed(1) : "—";
    pills.push({ key: "reviews", label: `${avg} · ${reviewsCount} review${reviewsCount !== 1 ? "s" : ""}` });
  }
  if (verifiedGigsCount != null && verifiedGigsCount > 0) {
    pills.push({ key: "gigs", label: `${verifiedGigsCount} verified gig${verifiedGigsCount !== 1 ? "s" : ""}` });
  }

  if (pills.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-2" aria-label="Trust and verification">
      {pills.map(({ key, label, title }) => (
        <span key={key} className={pillClass} title={title}>
          {label}
        </span>
      ))}
    </section>
  );
}
