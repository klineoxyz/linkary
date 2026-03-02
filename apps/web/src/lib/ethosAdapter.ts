/**
 * ETHOS adapter: single source of truth for tier label + color.
 *
 * Flow:
 * 1. ETHOS fetch: api/ethos/score (GET ?userkey=...), refreshScores.ts, or worker sync_ethos_xscore_daily.
 *    Response: score_value (number) + score_json (object; may contain score, label, levelKey, color from API).
 * 2. Adapter: normalizeEthosBadge(input) → { rawScore, label, levelKey, color }.
 *    If API provides label/levelKey/color (e.g. in score_json), use them; else derive from rawScore via fallback bands.
 * 3. Pill: EthosPill component renders "<Label> • <rawScore>" with tier color (hex → inline style; else Tailwind by levelKey).
 *    Used on public profile (PublicOnePager), profile overview (App ScorePills), PublicStandaloneProfile, Insights (InsightsSnapshot).
 * 4. Scoring prep: ethosToComponentScore(rawScore) → 0–100. Not wired into REP calculation yet.
 */

export type EthosBadge = {
  rawScore: number | null;
  label: string | null;
  levelKey: string | null;
  color: string | null;
};

/** Input: raw number (legacy), or API payload with optional label/levelKey/color. */
export type EthosBadgeInput =
  | number
  | null
  | undefined
  | {
      rawScore?: number | null;
      score?: number | null;
      label?: string | null;
      levelKey?: string | null;
      color?: string | null;
    };

const FALLBACK_BANDS: Array<{
  min: number;
  max: number;
  label: string;
  levelKey: string;
  color: string;
}> = [
  { min: 0, max: 799, label: "Untrusted", levelKey: "untrusted", color: "#dc2626" },
  { min: 800, max: 1199, label: "Questionable", levelKey: "questionable", color: "#ca8a04" },
  { min: 1200, max: 1399, label: "Neutral", levelKey: "neutral", color: "#171717" },
  { min: 1400, max: 1599, label: "Known", levelKey: "known", color: "#737373" },
  { min: 1600, max: 1799, label: "Established", levelKey: "established", color: "#1e3a5f" },
  { min: 1800, max: 1999, label: "Reputable", levelKey: "reputable", color: "#1e40af" },
  { min: 2000, max: 2199, label: "Exemplary", levelKey: "exemplary", color: "#22c55e" },
  { min: 2200, max: 2399, label: "Distinguished", levelKey: "distinguished", color: "#15803d" },
  { min: 2400, max: 2599, label: "Revered", levelKey: "revered", color: "#a855f7" },
  { min: 2600, max: 2800, label: "Renowned", levelKey: "renowned", color: "#6b21a8" },
];

function getFallbackForScore(score: number): { label: string; levelKey: string; color: string } {
  const band = FALLBACK_BANDS.find((b) => score >= b.min && score <= b.max);
  return band ?? FALLBACK_BANDS[0];
}

/**
 * Normalize ETHOS into a badge: rawScore, label, levelKey, color.
 * If the API provides label/levelKey/color (e.g. from score_json), use them; otherwise derive from rawScore bands.
 */
export function normalizeEthosBadge(input: EthosBadgeInput): EthosBadge {
  if (input == null) {
    return { rawScore: null, label: null, levelKey: null, color: null };
  }

  let rawScore: number | null = null;
  let fromApi: { label?: string | null; levelKey?: string | null; color?: string | null } = {};

  if (typeof input === "number" && Number.isFinite(input)) {
    rawScore = input;
  } else if (typeof input === "object") {
    rawScore =
      typeof (input as { rawScore?: unknown }).rawScore === "number"
        ? (input as { rawScore: number }).rawScore
        : typeof (input as { score?: unknown }).score === "number"
          ? (input as { score: number }).score
          : null;
    fromApi = {
      label: (input as { label?: string | null }).label ?? undefined,
      levelKey: (input as { levelKey?: string | null }).levelKey ?? undefined,
      color: (input as { color?: string | null }).color ?? undefined,
    };
  }

  if (rawScore == null || !Number.isFinite(rawScore)) {
    return { rawScore: null, label: null, levelKey: null, color: null };
  }

  const fallback = getFallbackForScore(rawScore);
  return {
    rawScore,
    label: fromApi.label ?? fallback.label,
    levelKey: fromApi.levelKey ?? fallback.levelKey,
    color: fromApi.color ?? fallback.color,
  };
}

/**
 * Convert ETHOS raw score to a 0–100 component score for future use in composite scoring.
 * NOT wired into REP calculation yet.
 */
export function ethosToComponentScore(rawScore: number | null): number | null {
  if (rawScore == null || !Number.isFinite(rawScore)) return null;
  const clamped = Math.max(0, Math.min(2800, rawScore));
  return Math.round((clamped / 2800) * 100);
}
