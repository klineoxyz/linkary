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
 * 4. REP component: ethosToComponentScore(rawScore) → 0–100 by tier bands (Untrusted→10 … Renowned→100). Used in repScore.ts.
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
  } else if (typeof input === "string" && input.trim() !== "") {
    const n = Number(input);
    if (Number.isFinite(n)) rawScore = n;
  }
  if (rawScore == null && typeof input === "object") {
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

/** ETHOS raw score bands → REP component score (0–100). 2600–2800 = 100; 2200–2399 = 80; etc. */
const ETHOS_COMPONENT_BANDS: Array<{ min: number; max: number; component: number }> = [
  { min: 0, max: 799, component: 10 },       // Untrusted
  { min: 800, max: 1199, component: 20 },    // Questionable
  { min: 1200, max: 1399, component: 30 },   // Neutral
  { min: 1400, max: 1599, component: 40 },   // Known
  { min: 1600, max: 1799, component: 50 },   // Established
  { min: 1800, max: 1999, component: 60 },   // Reputable
  { min: 2000, max: 2199, component: 70 },   // Exemplary
  { min: 2200, max: 2399, component: 80 },  // Distinguished
  { min: 2400, max: 2599, component: 90 },  // Revered
  { min: 2600, max: 2800, component: 100 },  // Renowned
];

/**
 * Convert ETHOS raw score (0–2800) to a 0–100 component score for REP SocialBase.
 * Tiered bands: 0–799→10, 800–1199→20, … 2600–2800→100. Used in repScore.ts for the ETHOS row in the breakdown.
 */
export function ethosToComponentScore(rawScore: number | null): number | null {
  if (rawScore == null || !Number.isFinite(rawScore)) return null;
  const clamped = Math.max(0, Math.min(2800, rawScore));
  const band = ETHOS_COMPONENT_BANDS.find((b) => clamped >= b.min && clamped <= b.max);
  return band?.component ?? 10;
}
