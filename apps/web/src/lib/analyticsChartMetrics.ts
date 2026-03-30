/**
 * Pure helpers for analytics chart headers — derived only from existing KPI / series shapes.
 * No API or ingestion changes.
 */

export type AnalyticsSignal = "good" | "watch" | "risk" | "neutral";

export function priorEngagementRatePct(kpis: {
  prior_engagements_total?: number;
  prior_potential_reach?: number;
}): number | null {
  const imp = Number(kpis.prior_potential_reach);
  const eng = Number(kpis.prior_engagements_total);
  if (!Number.isFinite(imp) || imp <= 0 || !Number.isFinite(eng)) return null;
  return (eng / imp) * 100;
}

export function pctChangeVsPrior(current: number, prior: number | null): number | null {
  if (prior == null || !Number.isFinite(prior) || prior === 0 || !Number.isFinite(current)) return null;
  return ((current - prior) / prior) * 100;
}

export function engagementSignal(deltaPct: number | null, currentPct: number): AnalyticsSignal {
  if (deltaPct == null) return currentPct > 0 ? "neutral" : "watch";
  if (deltaPct >= 5 && currentPct > 0) return "good";
  if (deltaPct <= -5 || (currentPct === 0 && deltaPct < 0)) return "risk";
  return "watch";
}

export function postingSignal(deltaPct: number | null, currentPosts: number): AnalyticsSignal {
  if (deltaPct == null) return currentPosts > 0 ? "neutral" : "watch";
  if (deltaPct >= 10) return "good";
  if (deltaPct <= -15) return "risk";
  return "watch";
}

export function followerSignal(netChange: number, coverageDays: number, windowDays: number): AnalyticsSignal {
  const ratio = windowDays > 0 ? coverageDays / windowDays : 0;
  if (ratio < 0.35) return "watch";
  if (netChange > 0 && ratio >= 0.5) return "good";
  if (netChange < 0) return "risk";
  return "watch";
}

export function coverageConfidenceLabel(coverageDays: number, windowDays: number): string {
  if (windowDays <= 0) return "";
  const pct = Math.round((coverageDays / windowDays) * 100);
  if (pct >= 85) return "High confidence";
  if (pct >= 50) return "Medium confidence";
  return "Directional — limited snapshots";
}

export function netFollowerDeltaFromSeries(
  points: ReadonlyArray<{ follower_delta: number | null }>
): number {
  let s = 0;
  for (const p of points) {
    const d = p.follower_delta;
    if (d != null && Number.isFinite(Number(d))) s += Number(d);
  }
  return s;
}

export function formatSignedInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(Math.round(n));
  const fmt = abs.toLocaleString();
  if (n > 0) return `+${fmt}`;
  if (n < 0) return `−${fmt}`;
  return "0";
}

/** Plain-language net trend for follower card insight (matches sum of daily snapshot deltas = chart end value). */
export function followerWindowNarrative(
  net: number,
  coverageDays: number,
  windowDays: number
): string {
  const conf = coverageConfidenceLabel(coverageDays, windowDays);
  const thin = windowDays >= 7 && coverageDays < Math.max(3, Math.round(windowDays * 0.15));
  const rounded = Math.round(net);
  let core: string;
  if (rounded > 0) {
    core = `Net gain of ${rounded.toLocaleString()} followers (sum of daily changes between stored snapshot totals).`;
  } else if (rounded < 0) {
    core = `Net loss of ${Math.abs(rounded).toLocaleString()} followers (sum of daily changes between stored snapshot totals).`;
  } else {
    core =
      "Net ~0 between captured snapshot days — totals barely moved, or snapshots are too sparse to reveal day-to-day change.";
  }
  const tail = thin
    ? `${conf} Treat direction as indicative until more snapshot days fill in.`
    : `${conf} The chart’s cumulative line ends at this net.`;
  return `${core} ${tail}`;
}
