import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Twitter,
  Users,
  MessageSquare,
  Repeat,
  Heart,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Sparkles,
  CheckCircle2,
  Eye,
  AlertTriangle,
  Activity,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * AnalyticsTabContent - Signals-First Embedded Analytics
 * Reads from DB only (no sync on load). Fetches /api/analytics/x for current user.
 */

function formatTimeAgo(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

interface AnalyticsTabContentProps {
  entityType?: "creator" | "project" | "agency";
  entityName?: string;
}

type SignalType = "good" | "watch" | "risk";

export default function AnalyticsTabContent({
  entityType = "creator",
  entityName = "This Profile",
}: AnalyticsTabContentProps) {
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "90D">("30D");
  const [apiData, setApiData] = useState<{
    profile: { followers_total?: number; avg_engagement_rate?: number; x_last_profile_sync_at?: string | null; x_last_tweets_sync_at?: string | null };
    rollup: Record<string, unknown> | null;
    baseline: { followers_total?: number | null; engagement_rate_proxy?: number | null } | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token || cancelled) return;
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/analytics/x`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok || cancelled) return;
      const json = await res.json().catch(() => ({}));
      if (!cancelled) setApiData({ profile: json.profile ?? {}, rollup: json.rollup ?? null, baseline: json.baseline ?? null });
    })();
    return () => { cancelled = true; };
  }, []);

  const profile = apiData?.profile ?? {};
  const rollup = apiData?.rollup;
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  const lastProfile = profile.x_last_profile_sync_at ?? profile.x_last_tweets_sync_at;

  const baseline = apiData?.baseline;
  const baselineFollowers = typeof baseline?.followers_total === "number" ? baseline.followers_total : 0;
  const baselineEngagement = typeof baseline?.engagement_rate_proxy === "number" ? baseline.engagement_rate_proxy : 0;
  const currentFollowers = typeof profile.followers_total === "number" ? profile.followers_total : 24587;
  const currentEngagement = typeof profile.avg_engagement_rate === "number" ? profile.avg_engagement_rate : 3.8;
  const pctChange = (cur: number, base: number) => (base > 0 && Number.isFinite(base) ? ((cur - base) / base) * 100 : 0);
  const followersGrowth = baselineFollowers > 0 ? pctChange(currentFollowers, baselineFollowers) : 12.4;
  const engagementGrowth = baselineEngagement >= 0 && (baselineEngagement > 0 || currentEngagement > 0) ? pctChange(currentEngagement, baselineEngagement || 0.01) : 0.6;

  const xAnalytics = {
    followers: currentFollowers,
    followersGrowth,
    engagementRate: currentEngagement,
    engagementGrowth,
    postsLast30Days: rollup ? num(rollup.posts_30d) : 84,
    postsDelta: -40.0,
    accountAge: "2 years 4 months",
    lastUpdated: lastProfile ? formatTimeAgo(lastProfile) : "— (sync from Settings → Integrations)",
    avgLikes: rollup ? num(rollup.avg_likes_30d) : 342,
    avgLikesGrowth: 18.2,
    avgReplies: rollup ? num(rollup.avg_replies_30d) : 28,
    avgRepliesGrowth: 22.0,
    avgReposts: 64,
    avgRepostsGrowth: -12.0,
    reachProxy: rollup ? (num(rollup.reach_proxy_30d) >= 1e6 ? `${(num(rollup.reach_proxy_30d) / 1e6).toFixed(1)}M` : `${(num(rollup.reach_proxy_30d) / 1e3).toFixed(1)}K`) : "1.2M",
    reachGrowth: 15.8,
  };

  const signals = [
    {
      id: "1",
      type: "good" as SignalType,
      title: "Engagement up +18% in 7D, driven by higher replies/post (+22%).",
      metric: "Engagement Rate: 3.8% (↑ 0.6%)",
    },
    {
      id: "2",
      type: "risk" as SignalType,
      title: "Posting frequency dropped 40% this month, growth slowed accordingly.",
      metric: "Posts: 84 (↓ 40%)",
    },
    {
      id: "3",
      type: "good" as SignalType,
      title: "Follower growth spiked on Feb 12-14, correlated with 2 high-performing posts.",
      metric: "Followers gained: +487 in 3 days",
    },
  ];

  const getSignalColor = (signal: SignalType) => {
    switch (signal) {
      case "good":
        return {
          bg: "from-emerald-500/10 to-emerald-500/5",
          border: "border-emerald-500/30",
          text: "text-emerald-400",
          icon: CheckCircle2,
        };
      case "watch":
        return {
          bg: "from-amber-500/10 to-amber-500/5",
          border: "border-amber-500/30",
          text: "text-amber-400",
          icon: Eye,
        };
      case "risk":
        return {
          bg: "from-red-500/10 to-red-500/5",
          border: "border-red-500/30",
          text: "text-red-400",
          icon: AlertTriangle,
        };
    }
  };

  const KPICard = ({ 
    label, 
    value, 
    delta, 
    signal, 
    icon: Icon 
  }: { 
    label: string; 
    value: string | number; 
    delta: number; 
    signal: SignalType; 
    icon: any;
  }) => {
    const signalStyle = getSignalColor(signal);
    const SignalIcon = signalStyle.icon;
    const isPositive = delta > 0;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5">
        {/* Signal Badge */}
        <div className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border}`}>
          <SignalIcon className={`w-3 h-3 ${signalStyle.text} stroke-[1.75]`} />
        </div>

        {/* Icon */}
        <div className="p-2 rounded-xl bg-white/5 border border-white/10 inline-flex mb-3">
          <Icon className="w-4 h-4 text-indigo-400 stroke-[1.75]" />
        </div>

        {/* Label */}
        <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
          {label}
        </p>

        {/* Value & Delta */}
        <div className="flex items-end gap-2 mb-1">
          <h3 className="text-3xl font-bold text-white">{value}</h3>
          <div className="flex items-center gap-1 mb-1">
            {isPositive ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400 stroke-[1.75]" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400 stroke-[1.75]" />
            )}
            <span className={`text-xs font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {isPositive ? "+" : ""}{delta}%
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30">
            <Twitter className="w-5 h-5 text-cyan-400 stroke-[1.75]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">X Analytics</h2>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-3 h-3 text-neutral-400 stroke-[1.75]" />
              <span className="text-xs text-neutral-400">Last updated: {xAnalytics.lastUpdated}</span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Time Range Toggle */}
        <div className="flex gap-2">
          {(["7D", "30D", "90D"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                timeRange === range
                  ? "bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30"
                  : "text-neutral-400 hover:text-white border border-white/10"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label="Followers"
          value={xAnalytics.followers.toLocaleString()}
          delta={xAnalytics.followersGrowth}
          signal="good"
          icon={Users}
        />
        <KPICard
          label="Engagement"
          value={`${xAnalytics.engagementRate}%`}
          delta={xAnalytics.engagementGrowth}
          signal="good"
          icon={Activity}
        />
        <KPICard
          label="Avg Likes"
          value={xAnalytics.avgLikes}
          delta={xAnalytics.avgLikesGrowth}
          signal="good"
          icon={Heart}
        />
        <KPICard
          label="Avg Replies"
          value={xAnalytics.avgReplies}
          delta={xAnalytics.avgRepliesGrowth}
          signal="good"
          icon={MessageSquare}
        />
        <KPICard
          label="Posts (30D)"
          value={xAnalytics.postsLast30Days}
          delta={xAnalytics.postsDelta}
          signal="risk"
          icon={Twitter}
        />
        <KPICard
          label="Reach Proxy"
          value={xAnalytics.reachProxy}
          delta={xAnalytics.reachGrowth}
          signal="good"
          icon={Target}
        />
      </div>

      {/* Signals Feed */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6">
        <div className="flex items-center gap-3 mb-5">
          <Sparkles className="w-5 h-5 text-amber-400 stroke-[1.75]" />
          <div>
            <h3 className="text-lg font-bold text-white">Signals</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              AI-detected insights from analytics
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {signals.map((signal, index) => {
            const signalStyle = getSignalColor(signal.type);
            const SignalIcon = signalStyle.icon;

            return (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className={`group relative overflow-hidden rounded-xl border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border} p-4 hover:scale-[1.01] transition-all cursor-pointer`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-1.5 rounded-lg bg-white/10 border border-white/20 flex-shrink-0">
                    <SignalIcon className={`w-4 h-4 ${signalStyle.text} stroke-[1.75]`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium mb-1 leading-relaxed">{signal.title}</p>
                    <p className={`text-xs ${signalStyle.text} font-medium`}>{signal.metric}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0 stroke-[1.75]" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Growth Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400 stroke-[1.75]" />
              Follower Growth
            </h3>
          </div>

          {/* Chart with axes */}
          <div className="flex gap-2">
            {/* Y-axis */}
            <div className="flex flex-col justify-between text-[10px] text-neutral-500 py-1">
              <span>30K</span>
              <span>20K</span>
              <span>10K</span>
            </div>

            {/* Chart area */}
            <div className="flex-1">
              <div className="relative h-32 flex items-end gap-1 border-l border-b border-white/10">
                {/* Grid lines */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-white/5"
                    style={{ bottom: `${i * 50}%` }}
                  />
                ))}

                {/* Bars */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const height = 30 + Math.random() * 70;
                  return (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-emerald-500/40 to-emerald-500/20 border-t border-emerald-500/50 relative group"
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-emerald-500/30 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        Day {i * 3 + 1}: {Math.round(20000 + (height / 100) * 10000).toLocaleString()}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between text-[10px] text-neutral-500 mt-1.5">
                <span>D1</span>
                <span>D15</span>
                <span>D30</span>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400 stroke-[1.75]" />
              Engagement Rate
            </h3>
          </div>

          {/* Chart with axes */}
          <div className="flex gap-2">
            {/* Y-axis */}
            <div className="flex flex-col justify-between text-[10px] text-neutral-500 py-1">
              <span>5%</span>
              <span>3%</span>
              <span>1%</span>
            </div>

            {/* Chart area */}
            <div className="flex-1">
              <div className="relative h-32 flex items-end gap-1 border-l border-b border-white/10">
                {/* Grid lines */}
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-white/5"
                    style={{ bottom: `${i * 50}%` }}
                  />
                ))}

                {/* Bars */}
                {Array.from({ length: 12 }).map((_, i) => {
                  const height = 25 + Math.random() * 65;
                  return (
                    <motion.div
                      key={i}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-500/40 to-indigo-500/20 border-t border-indigo-500/50 relative group"
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 }}
                    >
                      {/* Tooltip on hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-indigo-500/30 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                        Day {i * 3 + 1}: {(1.0 + (height / 100) * 4.0).toFixed(1)}%
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* X-axis labels */}
              <div className="flex justify-between text-[10px] text-neutral-500 mt-1.5">
                <span>D1</span>
                <span>D15</span>
                <span>D30</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Engagement Breakdown */}
      <div className="grid grid-cols-3 gap-4">
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/30">
              <Heart className="w-4 h-4 text-pink-400 stroke-[1.75]" />
            </div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Avg Likes
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{xAnalytics.avgLikes}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/30">
              <MessageSquare className="w-4 h-4 text-blue-400 stroke-[1.75]" />
            </div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Avg Replies
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{xAnalytics.avgReplies}</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Repeat className="w-4 h-4 text-emerald-400 stroke-[1.75]" />
            </div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
              Avg Reposts
            </p>
          </div>
          <p className="text-2xl font-bold text-white">{xAnalytics.avgReposts}</p>
        </div>
      </div>
    </div>
  );
}