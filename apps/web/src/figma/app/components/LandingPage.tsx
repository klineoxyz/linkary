import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Users,
  FileCheck,
  Shield,
  Search,
  TrendingUp,
  Zap,
  Building2,
  Crown,
  Twitter,
  Youtube,
  Radio,
  MessageCircle,
  ChevronRight,
  Eye,
  BadgeCheck,
  Target,
  LineChart,
  Award,
  ThumbsUp,
  Send,
  Check,
  X,
  Heart,
} from "lucide-react";

/**
 * Linkary Landing Page - Verifiable Reputation for Web3 Work
 * Light theme, mainstream conversion, living network hero
 */

interface LandingPageProps {
  setRoute: (route: any) => void;
}

// Mock profile cards for the living network hero
const MOCK_PROFILES = [
  {
    id: "1",
    type: "creator" as const,
    name: "Sarah Kim",
    handle: "@sarahcrypto",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    ethos: 842,
    xscore: 771,
    followers: "12.4K",
    engagement: "8.2%",
    verified: true,
  },
  {
    id: "2",
    type: "project" as const,
    name: "MatrixPay",
    handle: "/p/matrixpay",
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=matrix",
    ethos: 721,
    xscore: 806,
    followers: "24.1K",
    engagement: "12.4%",
    verified: true,
  },
  {
    id: "3",
    type: "creator" as const,
    name: "Alex Chen",
    handle: "@alexbuilds",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=alex",
    ethos: 912,
    xscore: 654,
    followers: "8.7K",
    engagement: "6.1%",
    verified: true,
  },
  {
    id: "4",
    type: "brand" as const,
    name: "Nexus Labs",
    handle: "/a/nexuslabs",
    avatar: "https://api.dicebear.com/7.x/shapes/svg?seed=nexus",
    ethos: 840,
    xscore: 792,
    followers: "18.2K",
    engagement: "9.7%",
    verified: true,
  },
];

export default function LandingPage({ setRoute }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<"x" | "youtube" | "tiktok">("x");
  const [selectedPlan, setSelectedPlan] = useState<"free" | "starter" | "pro" | "institutional">("pro");

  // Pricing tiers with SPECIFIC numbers (no "limited")
  const pricingPlans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      description: "Get started with basic reputation tracking",
      features: [
        "Public profile",
        "ETHOS + XScore + Index scores",
        "Analytics for your own profile only",
        "View 10 profiles/month",
        "Featured network only (no search)",
      ],
      cta: "Get Started",
      highlighted: false,
    },
    {
      id: "starter",
      name: "Starter",
      price: "$29",
      period: "/mo",
      description: "Perfect for individual creators building reputation",
      features: [
        "Full X analytics for your profile",
        "50 global searches/month",
        "View 50 profiles/month",
        "5 verification requests/month",
        "3 basic case studies",
      ],
      cta: "Start Free Trial",
      highlighted: false,
    },
    {
      id: "pro",
      name: "Pro",
      price: "$99",
      period: "/mo",
      badge: "Most Popular",
      description: "For professionals who need full visibility & verification",
      features: [
        "Unlimited global search + filters",
        "Unlimited profile views (shared/public)",
        "Shared analytics + compare view",
        "Projects, gigs, shortlists + AI recommendations",
        "Full verification workflow + priority queue",
        "Early access: YouTube + TikTok analytics",
      ],
      cta: "Start Free Trial",
      highlighted: true,
    },
    {
      id: "institutional",
      name: "Institutional",
      price: "Custom",
      description: "Enterprise solution for companies & agencies",
      features: [
        "Company profile + subsidiaries",
        "Team seats + permissions",
        "Advanced analytics compare",
        "Priority verification + API exports",
        "Dedicated support",
      ],
      cta: "Contact Sales",
      highlighted: false,
    },
  ];

  return (
    <div className="min-h-screen relative z-10">
      {/* Daily Drop Banner */}
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-500/20 text-sm font-medium text-gray-900">
              <Sparkles className="w-4 h-4 text-cyan-500 stroke-[1.75]" />
              Daily drop: New verified profiles today: <span className="text-cyan-600 font-bold">24</span>
            </span>
            <button
              onClick={() => setRoute({ name: "explore" })}
              className="text-sm text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1 transition-colors"
            >
              See today
              <ChevronRight className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </div>
      </div>

      {/* HERO SECTION - Living Network */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Copy + CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-6">
                Verifiable reputation
                <br />
                <span className="bg-gradient-to-r from-cyan-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  for Web3 work
                </span>
              </h1>
              <p className="text-xl text-gray-600 mb-4">
                Profiles, proof, and analytics in one place.
              </p>
              <p className="text-sm text-gray-500 mb-8 flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-4 h-4 text-emerald-500 stroke-[1.75]" />
                  Powered by ETHOS + Wallchain XScore
                </span>
                <span className="text-gray-400">•</span>
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="w-4 h-4 text-cyan-500 stroke-[1.75]" />
                  Verified by real counterparties
                </span>
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setRoute({ name: "profile" })}
                  className="group flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 text-white font-semibold text-lg hover:shadow-xl hover:shadow-cyan-500/30 transition-all hover:scale-105"
                >
                  Claim your username
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform stroke-[2]" />
                </button>
                <button
                  onClick={() => setRoute({ name: "explore" })}
                  className="flex items-center justify-center gap-2 px-8 py-4 rounded-xl border-2 border-gray-300 bg-white text-gray-900 font-semibold text-lg hover:border-gray-400 hover:bg-gray-50 transition-all"
                >
                  <Search className="w-5 h-5 stroke-[1.75]" />
                  Browse network
                </button>
              </div>
            </motion.div>

            {/* Right: Living Network Collage */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative h-[500px] lg:h-[600px]"
            >
              {/* Central Featured Card */}
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 z-20"
              >
                <div className="relative overflow-hidden rounded-3xl border-2 border-cyan-500/30 bg-white shadow-2xl shadow-cyan-500/20 p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-cyan-500/20">
                      <img src={MOCK_PROFILES[0].avatar} alt={MOCK_PROFILES[0].name} className="w-full h-full" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{MOCK_PROFILES[0].name}</h3>
                        {MOCK_PROFILES[0].verified && (
                          <BadgeCheck className="w-4 h-4 text-cyan-500 stroke-[1.75]" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{MOCK_PROFILES[0].handle}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                      <p className="text-xs text-emerald-600 font-medium mb-1">ETHOS</p>
                      <p className="text-lg font-bold text-gray-900">{MOCK_PROFILES[0].ethos}</p>
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <p className="text-xs text-violet-600 font-medium mb-1">XScore</p>
                      <p className="text-lg font-bold text-gray-900">{MOCK_PROFILES[0].xscore}</p>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Floating Mini Callouts */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.5, repeat: Infinity, repeatType: "reverse" }}
                className="absolute top-20 left-4 z-30"
              >
                <div className="px-4 py-2 rounded-full bg-white border border-gray-200 shadow-lg flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rose-500 stroke-[1.75]" />
                  <span className="text-sm font-semibold text-gray-900">Avg likes 153</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 1, delay: 0.7, repeat: Infinity, repeatType: "reverse" }}
                className="absolute top-32 right-8 z-30"
              >
                <div className="px-4 py-2 rounded-full bg-white border border-gray-200 shadow-lg flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-500 stroke-[1.75]" />
                  <span className="text-sm font-semibold text-gray-900">Referrals 56</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.9, repeat: Infinity, repeatType: "reverse" }}
                className="absolute bottom-32 left-12 z-30"
              >
                <div className="px-4 py-2 rounded-full bg-white border border-gray-200 shadow-lg flex items-center gap-2">
                  <Zap className="w-4 h-4 text-violet-500 stroke-[1.75]" />
                  <span className="text-sm font-semibold text-gray-900">X Score 67</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 1.1, repeat: Infinity, repeatType: "reverse" }}
                className="absolute bottom-24 right-12 z-30"
              >
                <div className="px-4 py-2 rounded-full bg-white border border-gray-200 shadow-lg flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-500 stroke-[1.75]" />
                  <span className="text-sm font-semibold text-gray-900">Earned 400 points</span>
                </div>
              </motion.div>

              {/* Background Profile Cards */}
              {MOCK_PROFILES.slice(1).map((profile, idx) => (
                <motion.div
                  key={profile.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.4, scale: 1 }}
                  transition={{ duration: 1.5, delay: idx * 0.3 }}
                  className="absolute w-56"
                  style={{
                    top: `${20 + idx * 25}%`,
                    left: idx % 2 === 0 ? "5%" : "auto",
                    right: idx % 2 === 1 ? "5%" : "auto",
                  }}
                >
                  <div className="rounded-2xl border border-gray-200 bg-white/60 backdrop-blur-sm p-4 shadow-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden">
                        <img src={profile.avatar} alt={profile.name} className="w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{profile.name}</p>
                        <p className="text-xs text-gray-600 truncate">{profile.handle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-700 font-medium">
                        {profile.ethos}
                      </span>
                      <span className="text-xs px-2 py-1 rounded bg-violet-500/10 text-violet-700 font-medium">
                        {profile.xscore}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Social Proof Strip */}
      <section className="py-12 border-y border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-emerald-500 stroke-[1.75]" />
              <span className="text-sm font-semibold text-gray-700">ETHOS Score</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-violet-500 stroke-[1.75]" />
              <span className="text-sm font-semibold text-gray-700">Wallchain XScore</span>
            </div>
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-cyan-500 stroke-[1.75]" />
              <span className="text-sm font-semibold text-gray-700">Verified Work</span>
            </div>
            <div className="flex items-center gap-2">
              <LineChart className="w-6 h-6 text-indigo-500 stroke-[1.75]" />
              <span className="text-sm font-semibold text-gray-700">Signals-First Analytics</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How it works</h2>
            <p className="text-xl text-gray-600">Build verifiable reputation in three steps</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="relative p-8 rounded-3xl border border-gray-200 bg-white hover:shadow-xl transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/10 border border-cyan-500/30 flex items-center justify-center mb-6">
                <FileCheck className="w-6 h-6 text-cyan-600 stroke-[1.75]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Add work</h3>
              <p className="text-gray-600">
                Upload projects, gigs, and case studies. Connect your X account for automatic analytics.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="relative p-8 rounded-3xl border border-gray-200 bg-white hover:shadow-xl transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-6">
                <BadgeCheck className="w-6 h-6 text-indigo-600 stroke-[1.75]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Get verified</h3>
              <p className="text-gray-600">
                Request verification from projects, clients, or agencies you worked with. Build trust through proof.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="relative p-8 rounded-3xl border border-gray-200 bg-white hover:shadow-xl transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/10 border border-violet-500/30 flex items-center justify-center mb-6">
                <TrendingUp className="w-6 h-6 text-violet-600 stroke-[1.75]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Show signals</h3>
              <p className="text-gray-600">
                Display ETHOS, XScore, and performance metrics. Let your reputation speak for itself.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Product Highlights */}
      <section className="py-20 lg:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Not a portfolio. A reputation graph.</h2>
            <p className="text-xl text-gray-600">Built from proof, not promises</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all"
            >
              <LineChart className="w-8 h-8 text-cyan-500 mb-4 stroke-[1.75]" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Signals, not vanity charts</h3>
              <p className="text-sm text-gray-600">
                See what changed and why. Growth metrics that explain momentum, not just big numbers.
              </p>
            </motion.div>

            {/* Card 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all"
            >
              <FileCheck className="w-8 h-8 text-indigo-500 mb-4 stroke-[1.75]" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Verified case studies</h3>
              <p className="text-sm text-gray-600">
                Real projects, real results. Get verification from actual counterparties who worked with you.
              </p>
            </motion.div>

            {/* Card 3 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all"
            >
              <Building2 className="w-8 h-8 text-violet-500 mb-4 stroke-[1.75]" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Company + subsidiaries</h3>
              <p className="text-sm text-gray-600">
                Your company profile can have subsidiaries. Each with their own role: project, agency, media.
              </p>
            </motion.div>

            {/* Card 4 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all"
            >
              <Users className="w-8 h-8 text-emerald-500 mb-4 stroke-[1.75]" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Ripple effect: affiliates + ambassadors</h3>
              <p className="text-sm text-gray-600">
                Your influence isn't just your account. Track your ambassadors, affiliates, and measurable reach.
              </p>
            </motion.div>

            {/* Card 5 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all"
            >
              <Target className="w-8 h-8 text-rose-500 mb-4 stroke-[1.75]" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Jobs, gigs, shortlists</h3>
              <p className="text-sm text-gray-600">
                AI-powered matching for opportunities. Get discovered by projects looking for your exact skills.
              </p>
            </motion.div>

            {/* Card 6 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              className="p-6 rounded-2xl border border-gray-200 bg-white hover:shadow-lg transition-all"
            >
              <Sparkles className="w-8 h-8 text-amber-500 mb-4 stroke-[1.75]" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">Living reputation graph</h3>
              <p className="text-sm text-gray-600">
                Carry your reputation anywhere: applying to jobs, pitching partnerships, raising rounds.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Platform Roadmap */}
      <section className="py-20 lg:py-32">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Multi-platform analytics</h2>
            <p className="text-xl text-gray-600">Track your influence across all channels</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setActiveTab("x")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === "x"
                  ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Twitter className="w-5 h-5 stroke-[1.75]" />
              X (Twitter)
            </button>
            <button
              onClick={() => setActiveTab("youtube")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === "youtube"
                  ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Youtube className="w-5 h-5 stroke-[1.75]" />
              YouTube
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-xs font-medium border border-amber-500/30">
                Soon
              </span>
            </button>
            <button
              onClick={() => setActiveTab("tiktok")}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === "tiktok"
                  ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Radio className="w-5 h-5 stroke-[1.75]" />
              TikTok
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 text-xs font-medium border border-amber-500/30">
                Soon
              </span>
            </button>
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="p-8 rounded-3xl border border-gray-200 bg-white shadow-xl"
          >
            {activeTab === "x" && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">X Analytics - Live Now</h3>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[1.75]" />
                    <span className="text-gray-700">Real-time follower growth tracking</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[1.75]" />
                    <span className="text-gray-700">Engagement rate analysis</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[1.75]" />
                    <span className="text-gray-700">Content performance signals</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 stroke-[1.75]" />
                    <span className="text-gray-700">Automated XScore updates</span>
                  </li>
                </ul>
              </div>
            )}
            {activeTab === "youtube" && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">YouTube Analytics - Coming Soon</h3>
                <p className="text-gray-600 mb-4">Track video performance and subscriber growth</p>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Early access available</strong> for Pro plan members. Sign up to get notified when we launch.
                  </p>
                </div>
              </div>
            )}
            {activeTab === "tiktok" && (
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">TikTok Analytics - Coming Soon</h3>
                <p className="text-gray-600 mb-4">Monitor viral content and audience engagement</p>
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>Early access available</strong> for Pro plan members. Sign up to get notified when we launch.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 lg:py-32 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-xl text-gray-600">No hidden fees. No surprises. Just clear value.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pricingPlans.map((plan) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className={`relative p-8 rounded-3xl border-2 transition-all hover:shadow-2xl ${
                  plan.highlighted
                    ? "border-cyan-500 bg-gradient-to-b from-cyan-50 to-white shadow-xl scale-105"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 rounded-full bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-sm font-semibold shadow-lg">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-5xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-600">{plan.period}</span>}
                  </div>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 stroke-[2] flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setRoute({ name: "profile" })}
                  className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:shadow-xl hover:scale-105"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {plan.cta}
                </button>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button
              onClick={() => setRoute({ name: "explore" })}
              className="text-cyan-600 hover:text-cyan-700 font-semibold flex items-center gap-2 mx-auto"
            >
              Compare all features
              <ChevronRight className="w-5 h-5 stroke-[1.75]" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logos/logo-black.png" alt="Linkary" className="h-8 w-auto" />
            </div>

            <div className="flex items-center gap-8">
              <button
                onClick={() => setRoute({ name: "explore" })}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Explore
              </button>
              <button
                onClick={() => setRoute({ name: "dashboard" })}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => setRoute({ name: "privacy" })}
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Privacy
              </button>
            </div>

            <p className="text-sm text-gray-500">
              © 2026 Linkary. Verifiable reputation for Web3.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}