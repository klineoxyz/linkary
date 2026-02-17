import React from "react";
import { Shield, Activity, Award, TrendingUp, Star, CheckCircle2, Zap, Users } from "lucide-react";
import { ReputationLevelCompact } from "./SharedComponents";

/**
 * AKARI Mystic-Style Reputation Business Card
 * Shareable digital business card for Web3 reputation
 * Variants: Creator, Project, Agency
 * Themes: Dark, Neon, Institutional
 */

export type CardTheme = "dark" | "neon" | "institutional";
export type CardType = "creator" | "project" | "agency";

interface ReputationCardProps {
  // Identity
  avatar: string;
  name: string;
  handle: string;
  accountTier: string;
  
  // Main Score
  reputationIndex: number;
  statusLine: string;
  
  // Reputation Level (Credibility System)
  reputationLevel?: number;
  reputationProgress?: number;
  
  // Metrics (varies by type)
  metrics: {
    ethos: number;
    xscore: number;
    reputationIndex: number;
    totalExposure?: string;
    circlePower?: string;
    ecosystemReach?: string;
    completedDeals?: number;
    rating?: number;
    totalPaid?: string;
    completionRate?: number;
    clientsServed?: number;
    verifiedCampaigns?: number;
  };
  
  // Type & Theme
  type: CardType;
  theme?: CardTheme;
  
  // For rendering
  watermark?: boolean;
}

export function ReputationCard({
  avatar,
  name,
  handle,
  accountTier,
  reputationIndex,
  statusLine,
  reputationLevel,
  reputationProgress,
  metrics,
  type,
  theme = "dark",
  watermark = true,
}: ReputationCardProps) {
  // Theme configurations
  const themes = {
    dark: {
      bg: "from-zinc-950 via-zinc-900 to-zinc-950",
      border: "border-white/10",
      grid: "rgba(255, 255, 255, 0.03)",
      glow: "rgba(99, 102, 241, 0.3)",
      scoreGlow: "text-indigo-400 drop-shadow-[0_0_30px_rgba(99,102,241,0.8)]",
      metricBg: "bg-white/5",
      metricBorder: "border-white/10",
    },
    neon: {
      bg: "from-violet-950 via-fuchsia-950 to-indigo-950",
      border: "border-fuchsia-500/30",
      grid: "rgba(217, 70, 239, 0.1)",
      glow: "rgba(217, 70, 239, 0.5)",
      scoreGlow: "text-fuchsia-400 drop-shadow-[0_0_40px_rgba(217,70,239,1)]",
      metricBg: "bg-fuchsia-500/10",
      metricBorder: "border-fuchsia-500/30",
    },
    institutional: {
      bg: "from-slate-900 via-blue-950 to-slate-900",
      border: "border-cyan-500/20",
      grid: "rgba(6, 182, 212, 0.05)",
      glow: "rgba(6, 182, 212, 0.4)",
      scoreGlow: "text-cyan-400 drop-shadow-[0_0_35px_rgba(6,182,212,0.9)]",
      metricBg: "bg-cyan-500/10",
      metricBorder: "border-cyan-500/20",
    },
  };

  const currentTheme = themes[theme];

  // Metric configurations by card type
  const getMetricsDisplay = () => {
    switch (type) {
      case "creator":
        return [
          { label: "ETHOS", value: metrics.ethos, icon: Shield },
          { label: "XScore", value: metrics.xscore, icon: Activity },
          { label: "Deals", value: metrics.completedDeals || 0, icon: CheckCircle2 },
          { label: "Rating", value: `${metrics.rating || 0}★`, icon: Star },
        ];
      case "project":
        return [
          { label: "ETHOS", value: metrics.ethos, icon: Shield },
          { label: "XScore", value: metrics.xscore, icon: Activity },
          { label: "Total Paid", value: metrics.totalPaid || "€0", icon: TrendingUp },
          { label: "Completion", value: `${metrics.completionRate || 0}%`, icon: CheckCircle2 },
        ];
      case "agency":
        return [
          { label: "ETHOS", value: metrics.ethos, icon: Shield },
          { label: "XScore", value: metrics.xscore, icon: Activity },
          { label: "Clients", value: metrics.clientsServed || 0, icon: Users },
          { label: "Campaigns", value: metrics.verifiedCampaigns || 0, icon: Zap },
        ];
    }
  };

  const metricsDisplay = getMetricsDisplay();

  return (
    <div className="relative w-[600px] h-[350px] rounded-3xl overflow-hidden">
      {/* Background with grid pattern */}
      <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.bg}`} />
      
      {/* Animated grid overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(${currentTheme.grid} 1px, transparent 1px),
            linear-gradient(90deg, ${currentTheme.grid} 1px, transparent 1px)
          `,
          backgroundSize: "30px 30px",
        }}
      />
      
      {/* Animated graph line aesthetic */}
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M 0 200 Q 150 150, 300 180 T 600 160"
          stroke={currentTheme.glow}
          strokeWidth="2"
          fill="none"
          className="animate-pulse"
        />
        <path
          d="M 0 250 Q 200 220, 400 240 T 600 220"
          stroke={currentTheme.glow}
          strokeWidth="1.5"
          fill="none"
          className="opacity-50"
        />
      </svg>

      {/* Border */}
      <div className={`absolute inset-0 border-2 ${currentTheme.border} rounded-3xl`} />

      {/* Glow effect */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl opacity-30"
        style={{ background: currentTheme.glow }}
      />

      {/* Content */}
      <div className="relative z-10 p-8 h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          {/* Left: Identity */}
          <div className="flex items-center gap-4">
            <img
              src={avatar}
              alt={name}
              className="w-16 h-16 rounded-2xl border-2 border-white/20 shadow-2xl"
            />
            <div>
              <h3 className="text-xl font-bold text-white mb-0.5">{name}</h3>
              <p className="text-sm text-neutral-400 mb-1">@{handle}</p>
              <div className="flex flex-col gap-1.5">
                <span className={`text-[10px] px-2 py-1 rounded-full ${currentTheme.metricBg} border ${currentTheme.metricBorder} text-white font-semibold uppercase tracking-wide inline-block w-fit`}>
                  {accountTier}
                </span>
                {reputationLevel && reputationProgress !== undefined && (
                  <div className={`px-2 py-1 rounded-full ${currentTheme.metricBg} border ${currentTheme.metricBorder} inline-block w-fit`}>
                    <ReputationLevelCompact
                      level={reputationLevel}
                      progress={reputationProgress}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Main Score */}
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 font-bold">
              LINKARY SCORE
            </div>
            <div className={`text-6xl font-black ${currentTheme.scoreGlow} mb-1`}>
              {reputationIndex}
            </div>
            <div className="text-xs text-neutral-400 font-medium">{statusLine}</div>
          </div>
        </div>

        {/* Exposure Metrics (if available) */}
        {(metrics.totalExposure || metrics.circlePower || metrics.ecosystemReach) && (
          <div className={`mb-6 p-4 rounded-2xl ${currentTheme.metricBg} border ${currentTheme.metricBorder} backdrop-blur-xl`}>
            <div className="grid grid-cols-3 gap-4 text-center">
              {metrics.totalExposure && (
                <div>
                  <div className="text-xs text-neutral-400 mb-1 uppercase tracking-wide">Total Exposure</div>
                  <div className="text-lg font-bold text-white">{metrics.totalExposure}</div>
                </div>
              )}
              {metrics.circlePower && (
                <div>
                  <div className="text-xs text-neutral-400 mb-1 uppercase tracking-wide">Circle Power</div>
                  <div className="text-lg font-bold text-white">{metrics.circlePower}</div>
                </div>
              )}
              {metrics.ecosystemReach && (
                <div>
                  <div className="text-xs text-neutral-400 mb-1 uppercase tracking-wide">Ecosystem Reach</div>
                  <div className="text-lg font-bold text-white">{metrics.ecosystemReach}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metric Breakdown Row */}
        <div className="mt-auto grid grid-cols-4 gap-3">
          {metricsDisplay.map((metric, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-xl ${currentTheme.metricBg} border ${currentTheme.metricBorder} backdrop-blur-xl`}
            >
              <div className="flex items-center gap-2 mb-1">
                <metric.icon className="w-4 h-4 text-neutral-400" />
                <div className="text-[10px] text-neutral-400 uppercase tracking-wide font-semibold">
                  {metric.label}
                </div>
              </div>
              <div className="text-xl font-bold text-white">{metric.value}</div>
            </div>
          ))}
        </div>

        {/* Watermark */}
        {watermark && (
          <div className="absolute bottom-6 right-8 text-[10px] text-neutral-600 uppercase tracking-widest font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3" />
            Verified via Linkary
          </div>
        )}
      </div>
    </div>
  );
}

// Helper to calculate Total Exposure
export function calculateTotalExposure(data: {
  creatorFollowers?: number;
  projectEcosystemReach?: number;
  ambassadorNetwork?: number;
  affiliateNetwork?: number;
  partnerReach?: number;
}): string {
  const total =
    (data.creatorFollowers || 0) +
    (data.projectEcosystemReach || 0) +
    (data.ambassadorNetwork || 0) +
    (data.affiliateNetwork || 0) +
    (data.partnerReach || 0);

  if (total >= 1000000) {
    return `${(total / 1000000).toFixed(1)}M`;
  } else if (total >= 1000) {
    return `${(total / 1000).toFixed(1)}K`;
  }
  return total.toString();
}

// Rank percentile helper
export function getRankPercentile(score: number, category: string): string {
  // Mock implementation - would be calculated from real data
  const percentile = Math.floor((score / 1000) * 100);
  return `Top ${100 - percentile}% in ${category}`;
}