import React, { useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft,
  BarChart3,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Shield,
  Clock,
  Twitter,
  Youtube,
  Video,
  ChevronRight,
  MessageSquare,
  Heart,
  Repeat,
  Users,
  Activity,
  Calendar,
  Zap,
  Target,
} from "lucide-react";
import FlipCard from "./FlipCard";

/**
 * Linkary Analytics Page - Signals-First Dashboard
 * Rich insights with numbers + AI-ready signal system
 * Platform-agnostic structure (X now, YouTube/TikTok later)
 */

type SignalType = "good" | "watch" | "risk";
type PlatformType = "x" | "youtube" | "tiktok";
type VisibilityType = "public" | "shared" | "restricted";

interface KPITile {
  id: string;
  label: string;
  value: string;
  delta7D: number;
  delta30D: number;
  delta90D: number;
  signal: SignalType;
  insight: string;
  sparklineData?: number[];
}

interface Signal {
  id: string;
  type: SignalType;
  title: string;
  metric: string;
  timestamp?: string;
}

interface TopDriver {
  date: string;
  postType: "text" | "media" | "thread";
  likes: number;
  replies: number;
  reposts: number;
  engagementRate: number;
  growthContribution?: string;
}

export default function AnalyticsPage({ setRoute }: { setRoute?: (route: any) => void }) {
  const [activePlatform, setActivePlatform] = useState<PlatformType>("x");
  const [timePeriod, setTimePeriod] = useState<"7D" | "30D" | "90D">("30D");
  const [viewingEntity, setViewingEntity] = useState("My Analytics");
  const [entityType, setEntityType] = useState<"creator" | "project" | "agency" | "company">("creator");
  const [visibility, setVisibility] = useState<VisibilityType>("public");

  // Mock data for X platform
  const xKPIs: KPITile[] = [
    {
      id: "followers",
      label: "Followers",
      value: "24,587",
      delta7D: 2.3,
      delta30D: 12.4,
      delta90D: 20.0,
      signal: "good",
      insight: "Stable growth, consistent gains",
      sparklineData: [20, 22, 21, 23, 24, 24, 25],
    },
    {
      id: "engagement",
      label: "Engagement Rate",
      value: "3.8%",
      delta7D: 0.2,
      delta30D: 0.6,
      delta90D: 1.0,
      signal: "good",
      insight: "Up due to replies/post +22%",
      sparklineData: [3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8],
    },
    {
      id: "likes",
      label: "Avg Likes/Post",
      value: "342",
      delta7D: 8.5,
      delta30D: 18.2,
      delta90D: 25.0,
      signal: "good",
      insight: "Content resonating well",
      sparklineData: [280, 290, 310, 320, 330, 340, 342],
    },
    {
      id: "replies",
      label: "Avg Replies/Post",
      value: "28",
      delta7D: 12.0,
      delta30D: 22.0,
      delta90D: 30.0,
      signal: "good",
      insight: "Conversation indicator strong",
      sparklineData: [20, 21, 23, 24, 26, 27, 28],
    },
    {
      id: "frequency",
      label: "Posts (30D)",
      value: "84",
      delta7D: -15.0,
      delta30D: -40.0,
      delta90D: -50.0,
      signal: "risk",
      insight: "Frequency dropped, growth slowed",
      sparklineData: [120, 115, 105, 95, 90, 85, 84],
    },
    {
      id: "reach",
      label: "Reach Proxy",
      value: "1.2M",
      delta7D: 5.2,
      delta30D: 15.8,
      delta90D: 25.0,
      signal: "good",
      insight: "Rising engagement + follower trend",
      sparklineData: [0.9, 1.0, 1.05, 1.1, 1.15, 1.18, 1.2],
    },
  ];

  const signals: Signal[] = [
    {
      id: "1",
      type: "good",
      title: "Engagement up +18% in 7D, driven by higher replies/post (+22%).",
      metric: "Engagement Rate: 3.8% (↑ 0.6%)",
      timestamp: "Detected 2 hours ago",
    },
    {
      id: "2",
      type: "risk",
      title: "Posting frequency dropped 40% this month, growth slowed accordingly.",
      metric: "Posts: 84 (↓ 40% from 140)",
      timestamp: "Detected 1 day ago",
    },
    {
      id: "3",
      type: "good",
      title: "Follower growth spiked on Feb 12-14, correlated with 2 high-performing posts.",
      metric: "Followers gained: +487 in 3 days",
      timestamp: "Detected 3 days ago",
    },
    {
      id: "4",
      type: "watch",
      title: "Repost rate falling for 3 weeks, content may be too narrow.",
      metric: "Avg Reposts: 64 (↓ 12%)",
      timestamp: "Detected 5 days ago",
    },
  ];

  const topDrivers: TopDriver[] = [
    {
      date: "Feb 12, 2026",
      postType: "thread",
      likes: 1247,
      replies: 89,
      reposts: 234,
      engagementRate: 6.8,
      growthContribution: "+187 followers",
    },
    {
      date: "Feb 14, 2026",
      postType: "media",
      likes: 1089,
      replies: 67,
      reposts: 198,
      engagementRate: 5.9,
      growthContribution: "+142 followers",
    },
    {
      date: "Feb 10, 2026",
      postType: "text",
      likes: 892,
      replies: 54,
      reposts: 167,
      engagementRate: 4.7,
      growthContribution: "+98 followers",
    },
    {
      date: "Feb 8, 2026",
      postType: "media",
      likes: 734,
      replies: 43,
      reposts: 128,
      engagementRate: 4.2,
      growthContribution: "+67 followers",
    },
    {
      date: "Feb 6, 2026",
      postType: "thread",
      likes: 678,
      replies: 38,
      reposts: 112,
      engagementRate: 3.9,
      growthContribution: "+54 followers",
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

  const getPostTypeColor = (type: TopDriver["postType"]) => {
    switch (type) {
      case "thread":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30";
      case "media":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
      case "text":
        return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
    }
  };

  const platforms = [
    { id: "x" as PlatformType, label: "X", icon: Twitter, active: true },
    { id: "youtube" as PlatformType, label: "YouTube", icon: Youtube, active: false },
    { id: "tiktok" as PlatformType, label: "TikTok", icon: Video, active: false },
  ];

  const visibilityOptions = [
    { id: "public" as VisibilityType, label: "Public", icon: Eye },
    { id: "shared" as VisibilityType, label: "Shared", icon: Users },
    { id: "restricted" as VisibilityType, label: "Restricted", icon: Shield },
  ];

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-10">
        {/* Back Button */}
        {setRoute && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setRoute({ name: "dashboard" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-700 hover:text-gray-900 transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform stroke-[1.75]" />
            Back to Dashboard
          </motion.button>
        )}

        {/* A) Sticky Analytics Context Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-40 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6"
        >
          <div className="flex flex-col gap-4">
            {/* Row 1: Context + Platform Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: Context */}
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30">
                  <BarChart3 className="w-6 h-6 text-indigo-400 stroke-[1.75]" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-gray-900">{viewingEntity}</h1>
                    <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-300 text-xs font-medium border border-indigo-500/30">
                      {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {/* Visibility Selector */}
                    <div className="flex items-center gap-2">
                      {visibilityOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setVisibility(option.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            visibility === option.id
                              ? "bg-white/10 text-gray-900 border border-white/20"
                              : "text-gray-600 hover:text-gray-900 border border-transparent"
                          }`}
                        >
                          <option.icon className="w-3 h-3 stroke-[1.75]" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Last Synced */}
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Clock className="w-3 h-3 stroke-[1.75]" />
                      <span>Last synced: 2 hours ago</span>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Platform Tabs */}
              <div className="flex items-center gap-2">
                {platforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => platform.active && setActivePlatform(platform.id)}
                    disabled={!platform.active}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activePlatform === platform.id && platform.active
                        ? "bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-white border border-cyan-500/30"
                        : platform.active
                        ? "text-gray-600 hover:text-gray-900 border border-white/10 hover:border-white/20"
                        : "text-gray-500 border border-white/5 cursor-not-allowed"
                    }`}
                  >
                    <platform.icon className="w-4 h-4 stroke-[1.75]" />
                    {platform.label}
                    {!platform.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500">Soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Global Time Period Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Time Period:</span>
              <div className="flex items-center gap-2">
                {(["7D", "30D", "90D"] as const).map((period) => (
                  <motion.button
                    key={period}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTimePeriod(period)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      timePeriod === period
                        ? "bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/30"
                        : "bg-white/5 border border-white/10 text-gray-600 hover:text-gray-900 hover:border-white/20"
                    }`}
                  >
                    {period === "7D" ? "Last 7 Days" : period === "30D" ? "Last 30 Days" : "Last 90 Days"}
                  </motion.button>
                ))}
              </div>
              
              {/* Period Summary */}
              <div className="ml-auto flex items-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  {timePeriod === "7D" ? "7 days" : timePeriod === "30D" ? "30 days" : "90 days"} of data
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* B) KPI Signal Tiles Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {xKPIs.map((kpi, index) => {
            const signalStyle = getSignalColor(kpi.signal);
            const SignalIcon = signalStyle.icon;
            const delta = timePeriod === "7D" ? kpi.delta7D : timePeriod === "30D" ? kpi.delta30D : kpi.delta90D;
            const isPositive = delta > 0;

            return (
              <motion.div
                key={kpi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6 hover:border-white/20 transition-all group"
              >
                {/* Signal Badge */}
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border}`}>
                  <SignalIcon className={`w-3 h-3 ${signalStyle.text} stroke-[1.75]`} />
                  <span className={`text-xs font-medium ${signalStyle.text} capitalize`}>
                    {kpi.signal}
                  </span>
                </div>

                {/* Label */}
                <p className="text-sm font-medium text-gray-600 mb-2">{kpi.label}</p>

                {/* Value */}
                <div className="flex items-end gap-3 mb-3">
                  <h3 className="text-4xl font-bold text-gray-900">{kpi.value}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4 text-emerald-400 stroke-[1.75]" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-400 stroke-[1.75]" />
                    )}
                    <span className={`text-sm font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                      {isPositive ? "+" : ""}{delta}%
                    </span>
                  </div>
                </div>

                {/* Delta Toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setTimePeriod("7D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "7D"
                        ? "bg-white/10 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setTimePeriod("30D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "30D"
                        ? "bg-white/10 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    30D
                  </button>
                  <button
                    onClick={() => setTimePeriod("90D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "90D"
                        ? "bg-white/10 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    90D
                  </button>
                </div>

                {/* Sparkline */}
                {kpi.sparklineData && (
                  <div className="relative h-12 mb-3 flex items-end gap-1">
                    {kpi.sparklineData.map((value, idx) => {
                      const maxValue = Math.max(...kpi.sparklineData!);
                      const height = (value / maxValue) * 100;
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-t-sm bg-gradient-to-t from-indigo-500/40 to-indigo-500/20 border-t border-indigo-500/50 transition-all duration-300 hover:from-indigo-500/60 hover:to-indigo-500/40"
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Insight */}
                <p className="text-xs text-gray-600 leading-relaxed">{kpi.insight}</p>
              </motion.div>
            );
          })}
        </div>

        {/* C) Signals Feed (Primary Section) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-amber-400 stroke-[1.75]" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Signals</h2>
              <p className="text-sm text-gray-600 mt-1">
                AI-detected insights from your analytics data
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
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border} p-5 hover:scale-[1.01] transition-all cursor-pointer`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-white/10 border border-white/20 flex-shrink-0">
                      <SignalIcon className={`w-5 h-5 ${signalStyle.text} stroke-[1.75]`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-gray-900 font-semibold mb-2 leading-relaxed">{signal.title}</h3>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${signalStyle.text} font-medium`}>{signal.metric}</p>
                        {signal.timestamp && (
                          <p className="text-xs text-gray-500">{signal.timestamp}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-900 group-hover:translate-x-1 transition-all flex-shrink-0 stroke-[1.75]" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* D) What Changed (Top Drivers Panel) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-cyan-400 stroke-[1.75]" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Top Drivers (30D)</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Posts that contributed most to your growth
                </p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Type
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Likes
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Replies
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Reposts
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    ER %
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((driver, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="py-4 text-sm text-gray-900 font-medium">{driver.date}</td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getPostTypeColor(driver.postType)}`}>
                        {driver.postType.charAt(0).toUpperCase() + driver.postType.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-pink-400 stroke-[1.75]" />
                        {driver.likes.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-400 stroke-[1.75]" />
                        {driver.replies}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <Repeat className="w-3.5 h-3.5 text-emerald-400 stroke-[1.75]" />
                        {driver.reposts}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm font-semibold text-cyan-400">
                      {driver.engagementRate}%
                    </td>
                    <td className="py-4 text-right text-sm font-semibold text-emerald-400">
                      {driver.growthContribution}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* E) Trend Explorer (Secondary Charts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Follower Growth Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400 stroke-[1.75]" />
                Follower Growth
              </h3>
              <div className="flex gap-2">
                {["7D", "30D", "90D"].map((range) => (
                  <button
                    key={range}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === "30D"
                        ? "bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30"
                        : "text-gray-600 hover:text-gray-900 border border-white/10"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart with axes */}
            <div className="flex gap-3">
              {/* Y-axis */}
              <div className="flex flex-col justify-between text-xs text-gray-500 py-2">
                <span>30K</span>
                <span>25K</span>
                <span>20K</span>
                <span>15K</span>
                <span>10K</span>
              </div>

              {/* Chart area */}
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-white/10">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ bottom: `${i * 25}%` }}
                    />
                  ))}

                  {/* Bars */}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = 30 + Math.random() * 70;
                    return (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-emerald-500/40 to-emerald-500/20 border-t border-emerald-500/50 relative group"
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-emerald-500/30 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Day {i + 1}: {Math.round(20000 + (height / 100) * 10000).toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  <span>Day 1</span>
                  <span>Day 7</span>
                  <span>Day 14</span>
                  <span>Day 21</span>
                  <span>Day 30</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Engagement Rate Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-cyan-400 stroke-[1.75]" />
                Engagement Rate
              </h3>
              <div className="flex gap-2">
                {["7D", "30D", "90D"].map((range) => (
                  <button
                    key={range}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === "30D"
                        ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-400 border border-indigo-500/30"
                        : "text-gray-600 hover:text-gray-900 border border-white/10"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart with axes */}
            <div className="flex gap-3">
              {/* Y-axis */}
              <div className="flex flex-col justify-between text-xs text-gray-500 py-2">
                <span>5.0%</span>
                <span>4.0%</span>
                <span>3.0%</span>
                <span>2.0%</span>
                <span>1.0%</span>
              </div>

              {/* Chart area */}
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-white/10">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ bottom: `${i * 25}%` }}
                    />
                  ))}

                  {/* Bars */}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = 25 + Math.random() * 65;
                    return (
                      <motion.div
                        key={i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-500/40 to-indigo-500/20 border-t border-indigo-500/50 relative group"
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-indigo-500/30 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Day {i + 1}: {(1.0 + (height / 100) * 4.0).toFixed(1)}%
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  <span>Day 1</span>
                  <span>Day 7</span>
                  <span>Day 14</span>
                  <span>Day 21</span>
                  <span>Day 30</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Posting Cadence Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400 stroke-[1.75]" />
                Posting Cadence (30D)
              </h3>
            </div>

            {/* Chart with axes */}
            <div className="flex gap-3">
              {/* Y-axis */}
              <div className="flex flex-col justify-between text-xs text-gray-500 py-2">
                <span>10</span>
                <span>8</span>
                <span>6</span>
                <span>4</span>
                <span>2</span>
              </div>

              {/* Chart area */}
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-white/10">
                  {/* Grid lines */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-white/5"
                      style={{ bottom: `${i * 25}%` }}
                    />
                  ))}

                  {/* Bars */}
                  {Array.from({ length: 30 }).map((_, i) => {
                    const height = 20 + Math.random() * 80;
                    const isWeekend = i % 7 === 5 || i % 7 === 6;
                    const posts = Math.round(2 + (height / 100) * 8);
                    return (
                      <motion.div
                        key={i}
                        className={`flex-1 rounded-t-md bg-gradient-to-t border-t relative group ${
                          isWeekend
                            ? "from-purple-500/20 to-purple-500/10 border-purple-500/30"
                            : "from-purple-500/40 to-purple-500/20 border-purple-500/50"
                        }`}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        {/* Tooltip on hover */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-purple-500/30 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          Day {i + 1}: {posts} posts {isWeekend ? "(Weekend)" : ""}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  <span>Day 1</span>
                  <span>Day 7</span>
                  <span>Day 14</span>
                  <span>Day 21</span>
                  <span>Day 30</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500/40 border border-purple-500/50" />
                Weekday
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
                Weekend
              </div>
            </div>
          </motion.div>
        </div>

        {/* Platform-Specific Notice (for future YouTube/TikTok) */}
        {activePlatform !== "x" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-amber-500/5 backdrop-blur-xl p-8 text-center"
          >
            <Zap className="w-12 h-12 text-amber-400 mx-auto mb-4 stroke-[1.75]" />
            <h3 className="text-xl font-bold text-white mb-2">
              {activePlatform === "youtube" ? "YouTube" : "TikTok"} Analytics Coming Soon
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              We're building {activePlatform === "youtube" ? "YouTube" : "TikTok"} integration with the same
              signals-first approach. Stay tuned!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}