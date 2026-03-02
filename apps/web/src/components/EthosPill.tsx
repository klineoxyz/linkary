"use client";

import { Shield } from "lucide-react";
import { normalizeEthosBadge, type EthosBadge, type EthosBadgeInput } from "@/lib/ethosAdapter";

const LEVEL_KEY_CLASSES: Record<string, string> = {
  untrusted: "border-red-500/50 text-red-700 bg-red-50 dark:bg-red-950/30 dark:text-red-400",
  questionable: "border-amber-500/50 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400",
  neutral: "border-zinc-500/50 text-zinc-800 bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-200",
  known: "border-zinc-400/50 text-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 dark:text-zinc-300",
  established: "border-blue-900/50 text-blue-800 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-300",
  reputable: "border-blue-800/50 text-blue-700 bg-blue-100/50 dark:bg-blue-950/50 dark:text-blue-300",
  exemplary: "border-green-500/50 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-400",
  distinguished: "border-green-700/50 text-green-800 bg-green-100/50 dark:bg-green-950/50 dark:text-green-400",
  revered: "border-violet-500/50 text-violet-700 bg-violet-50 dark:bg-violet-950/30 dark:text-violet-400",
  renowned: "border-purple-800/50 text-purple-800 bg-purple-100/50 dark:bg-purple-950/50 dark:text-purple-300",
};

export type EthosPillProps = {
  /** Pre-normalized badge (from API or normalizeEthosBadge). */
  ethosBadge?: EthosBadge | null;
  /** Raw score only; will be normalized with fallback bands. */
  ethosScore?: number | null;
  /** Optional API payload with optional label/levelKey/color. */
  ethosPayload?: EthosBadgeInput | null;
  className?: string;
};

/**
 * ETHOS pill: label + raw score with tier color.
 * Uses ethosBadge if provided; otherwise builds from ethosScore or ethosPayload via normalizeEthosBadge.
 */
export function EthosPill({ ethosBadge, ethosScore, ethosPayload, className = "" }: EthosPillProps) {
  const badge =
    ethosBadge ??
    (ethosScore != null ? normalizeEthosBadge(ethosScore) : ethosPayload != null ? normalizeEthosBadge(ethosPayload) : null);

  if (!badge || (badge.rawScore == null && !badge.label)) {
    return (
      <span
        className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border bg-muted/50 text-muted-foreground ${className}`}
        title="ETHOS not connected"
      >
        <Shield className="h-3.5 w-3.5 stroke-[1.75]" />
        ETHOS: Not connected
      </span>
    );
  }

  const label = badge.label ?? "ETHOS";
  const scoreText = badge.rawScore != null ? String(badge.rawScore) : "";
  const displayText = scoreText ? `${label} • ${scoreText}` : label;

  const isHex = typeof badge.color === "string" && badge.color.startsWith("#");
  const style = isHex && badge.color
    ? {
        borderColor: badge.color,
        color: badge.color,
        backgroundColor: `${badge.color}12`,
        borderWidth: 1,
        borderStyle: "solid",
      }
    : undefined;
  const levelClass = !isHex && badge.levelKey ? LEVEL_KEY_CLASSES[badge.levelKey] ?? "" : "";
  const baseClasses = "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border";

  return (
    <span
      className={[baseClasses, levelClass, className].filter(Boolean).join(" ")}
      style={style}
      title={`ETHOS: ${label}${scoreText ? ` (${scoreText})` : ""}`}
    >
      <Shield className="h-3.5 w-3.5 stroke-[1.75]" />
      {displayText}
    </span>
  );
}
