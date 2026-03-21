import React from "react";
import { Zap, Mic, Building2, TrendingUp, Sparkles } from "lucide-react";
import type { PlanKeyUi } from "@/lib/planPackageUi";

interface PlanBadgeProps {
  plan: PlanKeyUi | string;
  size?: "sm" | "md";
}

/** Normalize legacy demo keys if any old data slips through. */
function normalizePlanKey(plan: string): PlanKeyUi | null {
  const legacy: Record<string, PlanKeyUi> = {
    pro: "nano",
    speaker: "nano",
    host: "kol",
    brand: "startup",
    venture: "unicorn",
  };
  const k = legacy[plan] ?? (["free", "nano", "kol", "startup", "unicorn", "custom"].includes(plan) ? (plan as PlanKeyUi) : null);
  return k;
}

export default function PlanBadge({ plan, size = "sm" }: PlanBadgeProps) {
  const key = normalizePlanKey(String(plan));
  if (!key || key === "free") return null;

  const badges: Record<
    Exclude<PlanKeyUi, "free">,
    { label: string; icon: typeof Zap; bg: string; text: string }
  > = {
    nano: {
      label: "NANO",
      icon: Zap,
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
    kol: {
      label: "KOL",
      icon: Mic,
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
    startup: {
      label: "STARTUP",
      icon: Building2,
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
    unicorn: {
      label: "UNICORN",
      icon: TrendingUp,
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
    custom: {
      label: "CUSTOM",
      icon: Sparkles,
      bg: "bg-primary",
      text: "text-primary-foreground",
    },
  };

  const badge = badges[key];
  if (!badge) return null;
  const Icon = badge.icon;

  const sizeClasses = {
    sm: "h-5 px-2 text-[10px] gap-1",
    md: "h-6 px-2.5 text-xs gap-1.5",
  };

  const iconSizes = {
    sm: "h-2.5 w-2.5",
    md: "h-3 w-3",
  };

  return (
    <span
      className={`inline-flex items-center rounded ${badge.bg} ${badge.text} font-bold ${sizeClasses[size]} uppercase tracking-wide`}
    >
      <Icon className={iconSizes[size]} />
      {badge.label}
    </span>
  );
}
