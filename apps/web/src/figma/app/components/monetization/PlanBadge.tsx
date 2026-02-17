import React from "react";
import { Zap, Mic, Building2, TrendingUp } from "lucide-react";

interface PlanBadgeProps {
  plan: string;
  size?: "sm" | "md";
}

export default function PlanBadge({ plan, size = "sm" }: PlanBadgeProps) {
  if (plan === "free") return null;

  const badges = {
    pro: {
      label: "PRO",
      icon: Zap,
      color: "indigo",
      bg: "bg-indigo-600",
      text: "text-white",
    },
    host: {
      label: "HOST",
      icon: Mic,
      color: "purple",
      bg: "bg-purple-600",
      text: "text-white",
    },
    brand: {
      label: "BRAND",
      icon: Building2,
      color: "amber",
      bg: "bg-amber-600",
      text: "text-white",
    },
    venture: {
      label: "VENTURE",
      icon: TrendingUp,
      color: "red",
      bg: "bg-red-600",
      text: "text-white",
    },
  };

  const badge = badges[plan as keyof typeof badges];
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
